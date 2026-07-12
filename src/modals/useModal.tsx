/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import React, {
  createContext,
  useState,
  useContext,
  type ReactNode,
  useEffect,
} from "react";
import "./styles/modal.scss";

interface ModalContextType {
  isOpen: boolean;
  modalContent: ReactNode | null;
  openModal: (content: ReactNode) => void;
  closeModal: () => void;
}
const ModalContext = createContext<ModalContextType | undefined>(undefined);

interface ModalProviderProps {
  children: ReactNode;
}

const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<ReactNode | null>(null);
  const openModal = (content: ReactNode) => {
    setModalContent(content);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    // Delay clearing content slightly to allow fade-out animations if needed
    setTimeout(() => setModalContent(null), 200);
  };

  return (
    <ModalContext.Provider
      value={{ isOpen, openModal, closeModal, modalContent }}
    >
      {children}
      <ModalWrapper />
    </ModalContext.Provider>
  );
};

const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

export default ModalProvider;
export { useModal };
const ModalWrapper: React.FC = () => {
  const { isOpen, closeModal, modalContent } = useModal();
  const [shouldRender, setShouldRender] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (isOpen) {
      setShouldRender(true);
      timeoutId = setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
      timeoutId = setTimeout(() => setShouldRender(false), 400);
    }

    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div
      className={`modal-system-overlay ${animate ? "is-active" : ""}`}
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-system-content-host"
        onClick={(e) => e.stopPropagation()}
      >
        {modalContent}
      </div>
    </div>
  );
};
