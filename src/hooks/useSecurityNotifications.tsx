import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { toast } from 'sonner';
import { sanitizeForLogging } from '@/lib/security-utils';

interface SecurityNotification {
  id: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  timestamp: string;
}

export function useSecurityNotifications() {
  const { isAdminOrManager } = useUserRole();
  const [notifications, setNotifications] = useState<SecurityNotification[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (!isAdminOrManager() || !isEnabled) return;

    // Set up real-time subscription for critical alerts
    const subscription = supabase
      .channel('critical_security_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_alerts',
          filter: 'severity=in.(critical,high)'
        },
        (payload) => {
          const alert = payload.new as any;
          handleNewCriticalAlert(alert);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isAdminOrManager(), isEnabled]);

  const handleNewCriticalAlert = async (alert: any) => {
    try {
      const notification: SecurityNotification = {
        id: alert.id,
        alertType: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        timestamp: alert.created_at
      };

      // Add to notifications state
      setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep only 10 most recent

      // Show appropriate toast based on severity
      if (alert.severity === 'critical') {
        toast.error(`🚨 CRÍTICO: ${alert.title}`, {
          description: alert.description || 'Ação imediata necessária',
          duration: 10000, // 10 seconds for critical alerts
          action: {
            label: 'Ver Painel',
            onClick: () => window.location.href = '/security-monitoring'
          }
        });

        // Play notification sound for critical alerts
        playNotificationSound();
        
        // Show browser notification if permission granted
        showBrowserNotification(alert);
      } else if (alert.severity === 'high') {
        toast.warning(`⚠️ ALTA: ${alert.title}`, {
          description: alert.description || 'Verificação necessária',
          duration: 7000,
          action: {
            label: 'Ver Detalhes',
            onClick: () => window.location.href = '/security-monitoring'
          }
        });
      }

      // Send email notification for critical alerts (if configured)
      if (alert.severity === 'critical') {
        await sendEmailNotification(alert);
      }

    } catch (error) {
      console.error('Error handling security notification:', sanitizeForLogging(error));
    }
  };

  const playNotificationSound = () => {
    try {
      // Create a brief alert sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.debug('Could not play notification sound:', error);
    }
  };

  const showBrowserNotification = async (alert: any) => {
    try {
      if ('Notification' in window) {
        let permission = Notification.permission;
        
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        
        if (permission === 'granted') {
          new Notification(`🚨 Alerta de Segurança Crítico`, {
            body: alert.title,
            icon: '/favicon.ico',
            tag: 'security-alert',
            requireInteraction: true,
            silent: false
          });
        }
      }
    } catch (error) {
      console.debug('Could not show browser notification:', error);
    }
  };

  const sendEmailNotification = async (alert: any) => {
    try {
      // This would require an edge function to send emails
      // For now, we'll just log the attempt
      console.info('Critical security alert would trigger email notification:', {
        alert_id: alert.id,
        severity: alert.severity,
        title: alert.title,
        timestamp: alert.created_at
      });
      
      // TODO: Call edge function to send email notification
      // await supabase.functions.invoke('send-security-alert-email', {
      //   body: { alert }
      // });
    } catch (error) {
      console.error('Failed to send email notification:', sanitizeForLogging(error));
    }
  };

  const enableNotifications = async () => {
    try {
      // Request notification permission
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setIsEnabled(true);
          toast.success('Notificações de segurança ativadas');
        } else {
          toast.error('Permissão de notificação negada');
        }
      } else {
        setIsEnabled(true);
        toast.success('Notificações de segurança ativadas (somente toast)');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast.error('Erro ao ativar notificações');
    }
  };

  const disableNotifications = () => {
    setIsEnabled(false);
    toast.info('Notificações de segurança desativadas');
  };

  const clearNotifications = () => {
    setNotifications([]);
    toast.info('Notificações limpas');
  };

  const getUnreadCount = (): number => {
    return notifications.length;
  };

  return {
    notifications,
    isEnabled,
    enableNotifications,
    disableNotifications,
    clearNotifications,
    getUnreadCount,
    isSupported: 'Notification' in window
  };
}