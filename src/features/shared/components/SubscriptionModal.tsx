import React from 'react';
import { useSubscription } from '../hooks/useSubscription';

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
}

export function SubscriptionModal({ open, onClose }: SubscriptionModalProps) {
  const {
    isSubscribed,
    isLoading,
    error,
    isNative,
    productMonthly,
    productYearly,
    purchaseMonthly,
    purchaseYearly,
    restorePurchases,
    manageSubscriptions,
  } = useSubscription();

  if (!open || !isNative || isSubscribed) return null;

  const handlePurchaseMonthly = async () => {
    const success = await purchaseMonthly();
    if (success) onClose();
  };

  const handlePurchaseYearly = async () => {
    const success = await purchaseYearly();
    if (success) onClose();
  };

  const handleRestore = async () => {
    const restored = await restorePurchases();
    if (restored) {
      alert('Subscription restored successfully!');
      onClose();
    } else {
      alert('No active subscriptions found.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          color: '#fff',
          border: '2px solid #831843',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: '#f9a8d4', textAlign: 'center' }}>
          Unlock Premium Features
        </h2>

        <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#ccc' }}>
          Subscribe to use Shotcaller Nak Muay on your mobile device
        </p>

        {error && (
          <div
            style={{
              backgroundColor: '#ff4444',
              color: '#fff',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Monthly Subscription */}
          <button
            onClick={handlePurchaseMonthly}
            disabled={isLoading || !productMonthly}
            style={{
              backgroundColor: '#831843',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '1.25rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading || !productMonthly ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!isLoading && productMonthly) {
                e.currentTarget.style.backgroundColor = '#a01f54';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#831843';
            }}
          >
            <div>Monthly - $1/month</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.9 }}>
              7-day free trial
            </div>
          </button>

          {/* Yearly Subscription */}
          <button
            onClick={handlePurchaseYearly}
            disabled={isLoading || !productYearly}
            style={{
              backgroundColor: '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '1.25rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading || !productYearly ? 0.6 : 1,
              transition: 'all 0.2s',
              position: 'relative',
            }}
            onMouseOver={(e) => {
              if (!isLoading && productYearly) {
                e.currentTarget.style.backgroundColor = '#10b981';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#fbbf24',
                color: '#000',
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '12px',
                fontWeight: 'bold',
              }}
            >
              BEST VALUE
            </div>
            <div>Yearly - $10/year</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.9 }}>
              7-day free trial • Save 17%
            </div>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <button
            onClick={handleRestore}
            disabled={isLoading}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: '#f9a8d4',
              border: '1px solid #f9a8d4',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            Restore Purchase
          </button>

          <button
            onClick={() => manageSubscriptions()}
            disabled={isLoading}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: '#f9a8d4',
              border: '1px solid #f9a8d4',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            Manage Subscription
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            color: '#999',
            border: 'none',
            padding: '0.75rem',
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Close
        </button>

        <p
          style={{
            fontSize: '0.75rem',
            color: '#666',
            textAlign: 'center',
            marginTop: '1rem',
            marginBottom: 0,
            lineHeight: 1.4,
          }}
        >
          Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
          Cancel anytime in your Google Play account settings.
        </p>
      </div>
    </div>
  );
}
