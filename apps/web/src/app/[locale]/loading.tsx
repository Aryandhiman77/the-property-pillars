import {LoadingRows} from "@/components/ui/loading-skeleton";

export default function LoadingPage() {
  return <main className="market-width" aria-busy="true"><LoadingRows label="Loading page content" count={6}/></main>;
}
