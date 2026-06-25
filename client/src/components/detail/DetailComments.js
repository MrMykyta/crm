import DetailCard from './DetailCard';
import s from './DetailLayout.module.css';

export default function DetailComments({
  comments = [],
  title = 'Comments',
  emptyText = 'No comments yet.',
  composer,
  renderComment,
}) {
  return (
    <DetailCard title={title}>
      {composer ? <div className={s.commentComposer}>{composer}</div> : null}
      {comments.length ? (
        <div className={s.commentsList}>
          {comments.map((comment, index) => (
            <article key={comment.id || comment.key || index} className={s.commentItem}>
              {renderComment ? renderComment(comment) : (
                <>
                  <header>
                    <strong>{comment.author || comment.user || 'User'}</strong>
                    {comment.time || comment.date ? <time>{comment.time || comment.date}</time> : null}
                  </header>
                  <p>{comment.body || comment.text}</p>
                </>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className={s.emptyText}>{emptyText}</p>
      )}
    </DetailCard>
  );
}
