'use client';

import React, { useEffect, useState } from 'react';
import { GameNotification, BoardCell } from '@/types/game';
import { useAuth } from '@/context/AuthContext';
import { gameEngine, DEFAULT_BOARD } from '@/lib/game/engine';
import { sounds } from '@/lib/sound';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';

interface LiveOutbidToastProps {
  onSelectPosition: (cell: BoardCell) => void;
}

export const LiveOutbidToast: React.FC<LiveOutbidToastProps> = ({ onSelectPosition }) => {
  const { currentCompany, currentUser } = useAuth();
  const [activeAlert, setActiveAlert] = useState<GameNotification | null>(null);

  useEffect(() => {
    const unsubscribe = gameEngine.subscribe(({ type, payload }) => {
      if (type === 'OUTBID_ALERT') {
        const p = payload as { outbidNotif: GameNotification; targetCompanyId: string };
        if (currentCompany && p?.targetCompanyId === currentCompany.id) {
          sounds.playOutbid();
          setActiveAlert(p.outbidNotif);
        }
      }
    });

    return () => unsubscribe();
  }, [currentCompany]);

  if (!activeAlert) return null;

  const handleRebid = () => {
    if (activeAlert.position_id) {
      const cells = gameEngine.getBoardCells(DEFAULT_BOARD.id, currentUser?.id || 'guest');
      const targetCell = cells.find((c) => c.id === activeAlert.position_id);
      if (targetCell) {
        onSelectPosition(targetCell);
      }
    }
    setActiveAlert(null);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-red-950/90 border-2 border-red-500 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 animate-outbid-flash">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 animate-bounce" />
            <span>TERRITORY OUTBID!</span>
          </div>
          <button
            onClick={() => setActiveAlert(null)}
            className="text-red-400 hover:text-white p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-red-100 font-medium">{activeAlert.message}</p>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={() => setActiveAlert(null)}
            className="px-3 py-1.5 text-xs text-red-200 hover:text-white"
          >
            Dismiss
          </button>
          <button
            onClick={handleRebid}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <span>Rebid Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
