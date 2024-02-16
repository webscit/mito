
import { PostOrPage } from '@tryghost/content-api';
import Head from 'next/head';
import { GetStaticProps } from 'next/types';
import { useEffect, useState } from 'react';
import DownloadCTACard from '../../components/CTACards/DownloadCTACard';
import Footer from '../../components/Footer/Footer';
import PageTOC from '../../components/Glossary/PageTOC/PageTOC';
import pageStyles from '../../styles/Page.module.css';
import postStyles from '../../styles/[slug].module.css';
import { getPosts, getSinglePost } from '../../utils/posts';
import { SLUG_REDIRECTS } from '../blog';
import Header from '../../components/Header/Header';
import TwitterLogo from './TwitterLogo';
import EmailIcon from './EmailIcon';
import LinkedinLogo from './LinkedinLogo';

declare global {
  interface Window { Prism: any; }
}

// PostPage page component
const PostPage = (props: {post: PostOrPage}) => {
  // Get the current URL for sharing
  let [currentURL, setCurrentURL] = useState<string | undefined>(undefined);
  
  // Render post title and content in the page from props
  useEffect(() => {
    window.Prism.highlightAll();
    setCurrentURL(window.location.href);
  }, []);

  if (!props.post.html) {
    return <div>Not found</div>
  }

  const authorName = props.post.primary_author?.name;
  const publishedAt = props.post.published_at && new Intl.DateTimeFormat('en-US').format(new Date(props.post.published_at));
  const readingTime = props.post.reading_time;

  return (
    <>
      {/* Standard Mito header - includes navigation for the website. */}
      <Head>
        <title>{props.post.title} | Mito </title>
        <meta
          name="description"
          content={props.post.meta_description || props.post.excerpt?.slice(0, 99)}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Header />
        
      {/* All blog post related content */}
      <main className={pageStyles.main}>
        <div className={postStyles.post}>
        <div className={postStyles.decorative_line}/>

        {/* Blog Title Banner */}
        <div className={postStyles.post_banner}>
          {/* We use a wrapper around the post title to get the positioning in line with the post content. */}
          <div className={postStyles.post_title}>
              <div className={postStyles.post_metadata}>
                <p>
                  { authorName ? 'By '+ props.post.primary_author?.name: 'The Mito Team' }
                </p>
                {publishedAt && <p className={postStyles.post_additional_info}> {publishedAt}</p>}
                {readingTime && <p className={postStyles.post_additional_info}>{readingTime} min read</p>}
              </div>
              <h1>{props.post.title}</h1>
            </div>
          </div>

          {/* Table of Contents, post contents, and CTA */}
          <div className={postStyles.post_content_container}>
            {/* Table of Contents */}
            <div className={postStyles.post_toc}>
              <PageTOC />
            </div>
            {/* Post Contents */}
            <div className={postStyles.post_content}> 
              <div dangerouslySetInnerHTML={{ __html: props.post.html }}/>
              <div className={postStyles.share_section}>
                <a className={postStyles.tweet_button}
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(props.post.title ?? '')}&url=${encodeURIComponent(currentURL ?? '')}`}>
                  <TwitterLogo />
                </a>
                <a className={postStyles.email_button}
                  href={`mailto:?subject=${encodeURIComponent(props.post.title ?? '')}&body=${encodeURIComponent(currentURL ?? '')}`}>
                    <EmailIcon />
                  </a>
                <a className={postStyles.linkedin_button}
                  href={`https://linkedin.com/shareArticle?title=${encodeURIComponent(props.post.title ?? '')}&url=${encodeURIComponent(currentURL ?? '')}`}>
                    <LinkedinLogo />
                  </a>
              </div>

              {/* Suggested Posts */}
              <div className={postStyles.suggested_posts_section}>
                <h1>More Like This</h1>
                <div className={postStyles.suggested_posts_container}>
                  <a href='/blog/automating-spreadsheets-with-python-101' className={postStyles.suggested_post}>
                    <h4>Automating Spreadsheets with Python 101</h4>
                    <p>How to tell the difference between a good and bad Python automation target.</p>
                  </a>
                  <a href='/blog/10-mistakes-to-look-out-for-when-transitioning-from-excel-to-python' className={postStyles.suggested_post}>
                    <h4>10 Mistakes To Look Out For When Transitioning from Excel To Python</h4>
                    <p>10 Common Mistakes for new programmers transitioning from Excel to Python</p>
                  </a>
                  <a href='/blog/quantifying-mitos-impact-on-analyst-python-productivity' className={postStyles.suggested_post}>
                    <h4>Research shows Mito speeds up by 400%</h4>
                    <p>We're always on the hunt for tools that improve our efficiency at work. Tools that let us accomplish more with less time, money, and resources.</p>
                  </a>
                  <a href='/blog/choosing-between-sql-and-python-best-practices-for-data-analytics-workflows' className={postStyles.suggested_post}>
                    <h4>3 Rules for Choosing Between SQL and Python</h4>
                    <p>Analysts at the world's top banks are automating their manual Excel work so they can spend less time creating baseline reports, and more time building new analyses that push the company forward.</p>
                  </a>
                </div>
              </div>

            </div>

            {/* CTA */}
            <div className={postStyles.post_cta}>
              <DownloadCTACard headerStyle={{ fontSize: '2rem', color: 'var(--color-light-background-accent)', fontWeight: 'normal' }} />
            </div>
          </div>
        </div>
        

        {/* Footer */}
        <Footer />
      </main>
    </>
  )
}

export async function getStaticPaths() {
  const posts = await getPosts()

  if (!posts) {
    return {
      notFound: true,
    }
  }

  // Get the paths we want to create based on posts
  const paths = posts.map((post) => {
    return {
      params: { slug: post.slug },
    }
  }).concat(Object.keys(SLUG_REDIRECTS).map(key => {
    // Support all the new slug paths as well
    return {
      params: { slug: SLUG_REDIRECTS[key] },
    }
  }))

  // { fallback: false } means posts not found should 404.
  return { paths, fallback: false }
}


// Pass the page slug over to the "getSinglePost" function
// In turn passing it to the posts.read() to query the Ghost Content API
export const getStaticProps: GetStaticProps = async (context) => {
    const slug = context.params?.slug;

    // If the slug is in values of SLUG_REDIRECTS, get it's key for the slug
    // Otherwise, use the slug
    const slugToQuery = Object.keys(SLUG_REDIRECTS).find(key => SLUG_REDIRECTS[key] === slug) || slug;

    const post = slug && await getSinglePost(slugToQuery as string)

    if (!post) {
        return {
        notFound: true,
        }
    }

    return {
        props: { post }
    }
}

export default PostPage;