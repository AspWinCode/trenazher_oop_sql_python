import { useEffect } from 'react';
import { submissionsApi } from '../../../api';
import { SubmissionSocketClient } from '../../../services/realtime/submissionSocket';
import type { Submission } from '../../../types';

type SubmissionSetter = (updater: (prev: Submission | null) => Submission | null) => void;

/**
 * Подписывается на live-обновления уже существующей отправки и патчит её,
 * пока она не завершится. Используется на странице детального просмотра,
 * чтобы открытая queued/running отправка обновлялась без перезагрузки.
 */
export function useSubmissionLive(
  submissionId: number | null,
  isActive: boolean,
  setSubmission: SubmissionSetter,
) {
  useEffect(() => {
    if (submissionId == null || !isActive) return;

    let stopped = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let socket: SubmissionSocketClient | null = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const refetchFull = () => {
      submissionsApi
        .get(submissionId)
        .then(({ data }) => {
          if (!stopped) setSubmission(() => data);
        })
        .catch(() => {});
    };

    const startPolling = () => {
      stopPolling();
      pollTimer = setInterval(async () => {
        try {
          const { data } = await submissionsApi.get(submissionId);
          if (stopped) return;
          setSubmission(() => data);
          if (data.status === 'finished') stopPolling();
        } catch {
          // keep polling on transient failures
        }
      }, 1500);
    };

    const token = localStorage.getItem('token');
    if (!token) {
      startPolling();
      return () => {
        stopped = true;
        stopPolling();
      };
    }

    socket = new SubmissionSocketClient({
      token,
      submissionId,
      onUpdate: (msg) => {
        setSubmission((prev) =>
          prev
            ? {
                ...prev,
                status: msg.status,
                verdict: msg.verdict as Submission['verdict'],
                runtime: msg.runtime,
                memory: msg.memory,
                error_output: msg.error_output,
              }
            : prev,
        );
        if (msg.status === 'finished') {
          refetchFull();
          socket?.stop();
        }
      },
      onTerminalDisconnect: () => {
        if (!stopped) startPolling();
      },
    });
    socket.start();

    return () => {
      stopped = true;
      stopPolling();
      socket?.stop();
    };
  }, [submissionId, isActive, setSubmission]);
}
