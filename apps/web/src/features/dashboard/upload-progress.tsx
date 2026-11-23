import type {MediaDrafts} from "./media-drafts";
import styles from "./dashboard.module.css";

export function UploadProgress({progress}: Pick<MediaDrafts, "progress">) {
  if (!progress) return null;
  const {percent, finished, total, phase} = progress;
  return <div className={styles.uploadProgress}>
    <p role="status">{phase === "Saving" ? "Saving changes" : `${phase} media ${Math.min(finished + 1, total)} of ${total}`} · {percent}%</p>
    <progress aria-label="Media upload progress" value={percent} max={100} />
  </div>;
}
