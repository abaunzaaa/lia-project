import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';

/** Resultado pendiente de identificación por cámara (solo en memoria). */
export type CameraPendingResult = {
  name: string;
  activeIngredient?: string | null;
  purpose?: string | null;
  importantPoints?: string[];
  source?: string | null;
};

interface CameraRecognitionContextType {
  pendingResult: CameraPendingResult | null;
  setPendingResult: (result: CameraPendingResult | null) => void;
  clearPendingResult: () => void;
}

const CameraRecognitionContext = createContext<CameraRecognitionContextType | undefined>(
  undefined
);

export function CameraRecognitionProvider({ children }: { children: ReactNode }) {
  const [pendingResult, setPendingResultState] = useState<CameraPendingResult | null>(null);

  const setPendingResult = useCallback((result: CameraPendingResult | null) => {
    setPendingResultState(result);
  }, []);

  const clearPendingResult = useCallback(() => {
    setPendingResultState(null);
  }, []);

  const value = useMemo(
    () => ({
      pendingResult,
      setPendingResult,
      clearPendingResult,
    }),
    [pendingResult, setPendingResult, clearPendingResult]
  );

  return (
    <CameraRecognitionContext.Provider value={value}>
      {children}
    </CameraRecognitionContext.Provider>
  );
}

export function useCameraRecognition() {
  const context = useContext(CameraRecognitionContext);
  if (!context) {
    throw new Error('useCameraRecognition debe usarse dentro de CameraRecognitionProvider');
  }
  return context;
}
