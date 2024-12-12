from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal, Optional

from openai.types.chat import ChatCompletionMessageParam

@dataclass(frozen=True)
class CompletionRequest:
    """Message send by the client to request an AI chat response."""

    type: str
    """Message type."""
    message_id: str
    """Message UID generated by the client."""
    messages: list[ChatCompletionMessageParam]
    """Chat messages."""
    stream: bool = False
    """Whether to stream the response (if supported by the model)."""

@dataclass(frozen=True)
class CompletionItemError:
    """Completion item error information."""

    message: Optional[str] = None
    """Error message."""


@dataclass(frozen=True)
class CompletionItem:
    """The inline completion suggestion to be displayed on the frontend."""

    insertText: str
    """The text to insert into the editor."""
    isIncomplete: Optional[bool] = None
    """Whether the completion is incomplete or not."""
    token: Optional[str] = None
    """Unique token identifying the completion request in the frontend."""
    error: Optional[CompletionItemError] = None
    """Error information for the completion item."""


@dataclass(frozen=True)
class CompletionError:
    """Completion error description"""

    type: str
    """Error type"""
    title: str
    """Error title"""
    traceback: str
    """Error traceback"""


@dataclass(frozen=True)
class CompletionReply:
    """Message sent from model to client with the inline completion suggestions."""

    items: List[CompletionItem]
    """List of completion items."""
    parent_id: str
    """Parent message UID."""
    type: Literal["inline_completion"] = "inline_completion"
    """Message type."""
    error: Optional[CompletionError] = None
    """Completion error."""


@dataclass(frozen=True)
class CompletionStreamChunk:
    """Message sent from model to client with the infill suggestions"""

    chunk: CompletionItem
    """Completion item."""
    parent_id: str
    """Parent message UID."""
    done: bool
    """Whether the completion is done or not."""
    type: Literal["stream"] = "stream"
    """Message type."""
    error: Optional[CompletionError] = None
    """Completion error."""