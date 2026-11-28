import {LoadingRows} from "@/components/ui/loading-skeleton";

export default function MarketplaceLoading() {
  return <div className="market-width"><LoadingRows label="Loading page" count={5} /></div>;
}
