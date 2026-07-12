import { LogoIcon } from "../../../shared/components/icons/icons";
import { useStore } from "../../../core/store/useStore";
import type { StoreState } from "../../../core/store/useStore";

const Loading = () => {
  const isLoading = useStore((state: StoreState) => state.isLoading);
  return (
    <div className={`loading-container ${isLoading ? "active" : ""}`}>
      <div className="logo-wrapper">
        <LogoIcon size={80} />
        <h1 className="brand-title">Shadow Room</h1>
      </div>
    </div>
  );
};

export default Loading;
