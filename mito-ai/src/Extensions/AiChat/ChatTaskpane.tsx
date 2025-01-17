import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../../../style/ChatTaskpane.css';
import { INotebookTracker } from '@jupyterlab/notebook';
import { getActiveCellCode, writeCodeToActiveCell } from '../../utils/notebook';
import ChatMessage from './ChatMessage/ChatMessage';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ChatHistoryManager } from './ChatHistoryManager';
import { requestAPI } from '../../utils/handler';
import { IVariableManager } from '../VariableManager/VariableManagerPlugin';
import LoadingDots from '../../components/LoadingDots';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { getCodeBlockFromMessage, removeMarkdownCodeFormatting } from '../../utils/strings';
import { COMMAND_MITO_AI_APPLY_LATEST_CODE, COMMAND_MITO_AI_REJECT_LATEST_CODE, COMMAND_MITO_AI_SEND_DEBUG_ERROR_MESSAGE, COMMAND_MITO_AI_SEND_EXPLAIN_CODE_MESSAGE } from '../../commands';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import ResetIcon from '../../icons/ResetIcon';
import IconButton from '../../components/IconButton';
import { OperatingSystem } from '../../utils/user';
import { getCodeDiffsAndUnifiedCodeString, UnifiedDiffLine } from '../../utils/codeDiff';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { CodeCell } from '@jupyterlab/cells';
import { StateEffect, Compartment } from '@codemirror/state';
import { codeDiffStripesExtension } from './CodeDiffDisplay';
import OpenAI from "openai";
import ChatInput from './ChatMessage/ChatInput';
import SupportIcon from '../../icons/SupportIcon';

const getDefaultChatHistoryManager = (notebookTracker: INotebookTracker, variableManager: IVariableManager): ChatHistoryManager => {

    const chatHistoryManager = new ChatHistoryManager(variableManager, notebookTracker)
    chatHistoryManager.addSystemMessage('You are an expert Python programmer.')
    return chatHistoryManager
}

interface IChatTaskpaneProps {
    notebookTracker: INotebookTracker
    rendermime: IRenderMimeRegistry
    variableManager: IVariableManager
    app: JupyterFrontEnd
    operatingSystem: OperatingSystem
}

const ChatTaskpane: React.FC<IChatTaskpaneProps> = ({
    notebookTracker,
    rendermime,
    variableManager,
    app,
    operatingSystem
}) => {
    const [chatHistoryManager, setChatHistoryManager] = useState<ChatHistoryManager>(() => getDefaultChatHistoryManager(notebookTracker, variableManager));
    const chatHistoryManagerRef = useRef<ChatHistoryManager>(chatHistoryManager);

    const [loadingAIResponse, setLoadingAIResponse] = useState<boolean>(false)

    const [unifiedDiffLines, setUnifiedDiffLines] = useState<UnifiedDiffLine[] | undefined>(undefined)
    const originalCodeBeforeDiff = useRef<string | undefined>(undefined)

    useEffect(() => {
        /* 
            Why we use a ref (chatHistoryManagerRef) instead of directly accessing the state (chatHistoryManager):

            The reason we use a ref here is because the function `applyLatestCode` is registered once 
            when the component mounts via `app.commands.addCommand`. If we directly used `chatHistoryManager`
            in the command's execute function, it would "freeze" the state at the time of the registration 
            and wouldn't update as the state changes over time.

            React's state (`useState`) is asynchronous, and the registered command won't automatically pick up the 
            updated state unless the command is re-registered every time the state changes, which would require 
            unregistering and re-registering the command, causing unnecessary complexity.

            By using a ref (`chatHistoryManagerRef`), we are able to keep a persistent reference to the 
            latest version of `chatHistoryManager`, which is updated in this effect whenever the state 
            changes. This allows us to always access the most recent state of `chatHistoryManager` in the 
            `applyLatestCode` function, without needing to re-register the command or cause unnecessary re-renders.

            We still use `useState` for `chatHistoryManager` so that we can trigger a re-render of the chat
            when the state changes.
        */
        chatHistoryManagerRef.current = chatHistoryManager;
    }, [chatHistoryManager]);
    

    const getDuplicateChatHistoryManager = () => {

        /*
            We use getDuplicateChatHistoryManager() instead of directly accessing the state variable because 
            the COMMAND_MITO_AI_SEND_MESSAGE is registered in a useEffect on initial render, which
            would otherwise always use the initial state values. By using a function, we ensure we always
            get the most recent chat history, even when the command is executed later.        
        */
        return chatHistoryManagerRef.current.createDuplicateChatHistoryManager()
    }

    /* 
        Send a message with a specific input, clearing what is currently in the chat input.
        This is useful when we want to send the error message from the MIME renderer directly
        to the AI chat.
    */
    const sendDebugErrorMessage = async (errorMessage: string) => {

        // Step 1: Clear the chat history, and add the new error message
        const newChatHistoryManager = getDefaultChatHistoryManager(notebookTracker, variableManager)
        newChatHistoryManager.addDebugErrorMessage(errorMessage)
        setChatHistoryManager(newChatHistoryManager)

        // Step 2: Send the message to the AI
        const aiMessage = await _sendMessageToOpenAI(newChatHistoryManager)

        // Step 3: Update the code diff stripes
        updateCodeDiffStripes(aiMessage)
    }

    const sendExplainCodeMessage = () => {

        // Step 1: Clear the chat history, and add the explain code message
        const newChatHistoryManager = getDefaultChatHistoryManager(notebookTracker, variableManager)
        newChatHistoryManager.addExplainCodeMessage()
        setChatHistoryManager(newChatHistoryManager)
        
        // Step 2: Send the message to the AI
        _sendMessageToOpenAI(newChatHistoryManager)

        // Step 3: No post processing step needed for explaining code. 
    }

    /* 
        Send whatever message is currently in the chat input
    */
    const sendChatInputMessage = async (input: string) => {

        // Step 1: Add the user's message to the chat history
        const newChatHistoryManager = getDuplicateChatHistoryManager()
        newChatHistoryManager.addChatInputMessage(input)

        // Step 2: Send the message to the AI
        const aiMessage = await _sendMessageToOpenAI(newChatHistoryManager)

        // Step 3: Update the code diff stripes
        updateCodeDiffStripes(aiMessage)
    }

    const handleUpdateMessage = async (messageIndex: number, newContent: string) => {
        // Step 1: Update the chat history manager
        const newChatHistoryManager = getDuplicateChatHistoryManager()
        newChatHistoryManager.updateMessageAtIndex(messageIndex, newContent)

        // Step 2: Send the message to the AI
        const aiMessage = await _sendMessageToOpenAI(newChatHistoryManager)

        // Step 3: Update the code diff stripes
        updateCodeDiffStripes(aiMessage)
    };

    const _sendMessageToOpenAI = async (newChatHistoryManager: ChatHistoryManager) => {

        setLoadingAIResponse(true)

        let aiRespone = undefined

        try {
            const apiResponse = await requestAPI('mito_ai/completion', {
                method: 'POST',
                body: JSON.stringify({
                    messages: newChatHistoryManager.getAIOptimizedHistory()
                })
            });

            if (apiResponse.type === 'success') {
                const aiMessage = apiResponse.response;

                newChatHistoryManager.addAIMessageFromResponse(aiMessage);
                setChatHistoryManager(newChatHistoryManager);
                
                aiRespone = aiMessage
            } else {
                newChatHistoryManager.addAIMessageFromMessageContent(apiResponse.errorMessage, true)
                setChatHistoryManager(newChatHistoryManager);
            }
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
        } finally {
            setLoadingAIResponse(false)
            return aiRespone
        }
    }

    const updateCodeDiffStripes = (aiMessage: OpenAI.ChatCompletionMessage | undefined) => {
        if (!aiMessage) {
            return
        }

        const activeCellCode = getActiveCellCode(notebookTracker)

        // Extract the code from the AI's message and then calculate the code diffs
        const aiGeneratedCode = getCodeBlockFromMessage(aiMessage);
        const aiGeneratedCodeCleaned = removeMarkdownCodeFormatting(aiGeneratedCode || '');
        const { unifiedCodeString, unifiedDiffs } = getCodeDiffsAndUnifiedCodeString(activeCellCode, aiGeneratedCodeCleaned)

        // Store the original code so that we can revert to it if the user rejects the AI's code
        originalCodeBeforeDiff.current = activeCellCode || ''

        // Temporarily write the unified code string to the active cell so we can display
        // the code diffs to the user. Once the user accepts or rejects the code, we'll 
        // apply the correct version of the code.
        writeCodeToActiveCell(notebookTracker, unifiedCodeString)
        setUnifiedDiffLines(unifiedDiffs)
    }

    const displayOptimizedChatHistory = chatHistoryManager.getDisplayOptimizedHistory()

    const acceptAICode = () => {
        const latestChatHistoryManager = chatHistoryManagerRef.current;
        const lastAIMessage = latestChatHistoryManager.getLastAIMessage()
        
        if (!lastAIMessage) {
            return
        }

        const aiGeneratedCode = getCodeBlockFromMessage(lastAIMessage.message);
        if (!aiGeneratedCode) {
            return
        }

        _applyCode(aiGeneratedCode)
    }

    const rejectAICode = () => {
        const originalDiffedCode = originalCodeBeforeDiff.current
        if (originalDiffedCode === undefined) {
            return
        }
        _applyCode(originalDiffedCode)
    }

    const _applyCode = (code: string) => {
        writeCodeToActiveCell(notebookTracker, code, true)
        setUnifiedDiffLines(undefined)
        originalCodeBeforeDiff.current = undefined
    }

    const clearChatHistory = () => {
        setChatHistoryManager(getDefaultChatHistoryManager(notebookTracker, variableManager))
    }

    useEffect(() => {
        /* 
            Add a new command to the JupyterLab command registry that applies the latest AI generated code
            to the active code cell. Do this inside of the useEffect so that we only register the command
            the first time we create the chat. Registering the command when it is already created causes
            errors.
        */
        app.commands.addCommand(COMMAND_MITO_AI_APPLY_LATEST_CODE, {
            execute: () => {
                acceptAICode()
            }
        })

        app.commands.addCommand(COMMAND_MITO_AI_REJECT_LATEST_CODE, {
            execute: () => {
                rejectAICode()
            }
        })

        app.commands.addKeyBinding({
            command: COMMAND_MITO_AI_APPLY_LATEST_CODE,
            keys: ['Accel Y'],
            selector: 'body',
        });

        app.commands.addKeyBinding({
            command: COMMAND_MITO_AI_REJECT_LATEST_CODE,
            keys: ['Accel D'],
            selector: 'body',
        });

        /* 
            Add a new command to the JupyterLab command registry that sends the current chat message.
            We use this to automatically send the message when the user adds an error to the chat. 
        */
        app.commands.addCommand(COMMAND_MITO_AI_SEND_DEBUG_ERROR_MESSAGE, {
            execute: (args?: ReadonlyPartialJSONObject) => {
                if (args?.input) {
                    sendDebugErrorMessage(args.input.toString())
                }
            }
        })

        app.commands.addCommand(COMMAND_MITO_AI_SEND_EXPLAIN_CODE_MESSAGE, {
            execute: () => {
                sendExplainCodeMessage()
            }
        })
    }, [])

    // Create a WeakMap to store compartments per code cell
    const codeDiffStripesCompartments = React.useRef(new WeakMap<CodeCell, Compartment>());

    // Function to update the extensions of code cells
    const updateCodeCellsExtensions = useCallback(() => {
        const notebook = notebookTracker.currentWidget?.content;
        if (!notebook) {
            return;
        }

        const activeCellIndex = notebook.activeCellIndex

        notebook.widgets.forEach((cell, index) => {
            if (cell.model.type === 'code') {
                const isActiveCodeCell = activeCellIndex === index
                const codeCell = cell as CodeCell;
                const cmEditor = codeCell.editor as CodeMirrorEditor;
                const editorView = cmEditor?.editor;

                if (editorView) {
                    let compartment = codeDiffStripesCompartments.current.get(codeCell);

                    if (!compartment) {
                        // Create a new compartment and store it
                        compartment = new Compartment();
                        codeDiffStripesCompartments.current.set(codeCell, compartment);

                        // Apply the initial configuration
                        editorView.dispatch({
                            effects: StateEffect.appendConfig.of(
                                compartment.of(unifiedDiffLines !== undefined && isActiveCodeCell? codeDiffStripesExtension({ unifiedDiffLines: unifiedDiffLines }) : [])
                            ),
                        });
                    } else {
                        // Reconfigure the compartment
                        editorView.dispatch({
                            effects: compartment.reconfigure(
                                unifiedDiffLines !== undefined && isActiveCodeCell ? codeDiffStripesExtension({ unifiedDiffLines: unifiedDiffLines }) : []
                            ),
                        });
                    }
                } else {
                    console.log('Mito AI: editor view not found when applying code diff stripes')
                }
            }
        });
    }, [unifiedDiffLines, notebookTracker]);


    useEffect(() => {
        updateCodeCellsExtensions();
    }, [unifiedDiffLines, updateCodeCellsExtensions]);


    const lastAIMessagesIndex = chatHistoryManager.getLastAIMessageIndex()    

    return (
        <div className="chat-taskpane">
            <div className="chat-taskpane-header">
                <IconButton
                    icon={<SupportIcon />}
                    title="Get Help"
                    onClick={() => {
                        window.open('mailto:founders@sagacollab.com?subject=Mito AI Chat Support', '_blank');
                    }}
                />
                <IconButton
                    icon={<ResetIcon />}
                    title="Clear the chat history"
                    onClick={() => {clearChatHistory()}}
                />
            </div>
            <div className="chat-messages">
                {displayOptimizedChatHistory.map((displayOptimizedChat, index) => {
                    return (
                        <ChatMessage
                            message={displayOptimizedChat.message}
                            mitoAIConnectionError={displayOptimizedChat.type === 'connection error'}
                            messageIndex={index}
                            notebookTracker={notebookTracker}
                            rendermime={rendermime}
                            app={app}
                            isLastAiMessage={index === lastAIMessagesIndex}
                            operatingSystem={operatingSystem}
                            setDisplayCodeDiff={setUnifiedDiffLines}
                            acceptAICode={acceptAICode}
                            rejectAICode={rejectAICode}
                            onUpdateMessage={handleUpdateMessage}
                            variableManager={variableManager}
                        />
                    )
                }).filter(message => message !== null)}
            </div>
            {loadingAIResponse &&
                <div className="chat-loading-message">
                    Loading AI Response <LoadingDots />
                </div>
            }
            <ChatInput
                initialContent={''}
                placeholder={displayOptimizedChatHistory.length < 2 ? "Ask your personal Python expert anything!" : "Follow up on the conversation"}
                onSave={sendChatInputMessage}
                onCancel={undefined}
                isEditing={false}
                variableManager={variableManager}
            />
        </div>
    );
};

export default ChatTaskpane;