import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';

// Product IDs - these must match what you create in Google Play Console
const SUBSCRIPTION_PRODUCTS = {
  MONTHLY: 'premium_monthly',  // $1/month with 7-day trial
  YEARLY: 'premium_yearly',    // $10/year with 7-day trial
};

// Base plan IDs - these must match your Google Play Console base plan IDs
const BASE_PLANS = {
  MONTHLY: 'monthly-trial',
  YEARLY: 'yearly-trial',
};

// Local storage key for subscription status
const SUBSCRIPTION_STATUS_KEY = 'subscription_status';
const LAST_CHECK_KEY = 'subscription_last_check';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export interface SubscriptionState {
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  productMonthly: any | null;
  productYearly: any | null;
}

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    isSubscribed: false,
    isLoading: true,
    error: null,
    productMonthly: null,
    productYearly: null,
  });

  // Check if we're on a native platform
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) {
      // Web/PWA users get free access
      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      return;
    }

    initializeSubscription();
  }, [isNative]);

  const initializeSubscription = async () => {
    try {
      // TEMPORARY: Disable all billing to isolate TTS issue
      // Check if we have a cached subscription status
      const cachedStatus = localStorage.getItem(SUBSCRIPTION_STATUS_KEY);
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
      const now = Date.now();

      // If we have a cached "subscribed" status and it's less than 24 hours old, use it
      if (cachedStatus === 'subscribed' && lastCheck) {
        const timeSinceCheck = now - parseInt(lastCheck, 10);
        if (timeSinceCheck < CHECK_INTERVAL) {
          setState(prev => ({
            ...prev,
            isSubscribed: true,
            isLoading: false,
          }));
          return;
        }
      }

      // Assume subscribed for now to hide modal and test TTS
      setState(prev => ({
        ...prev,
        isSubscribed: true, // TEMPORARY: Set to true to skip modal
        isLoading: false,
      }));

      // DON'T load products - this might be breaking TTS
      // loadProductsInBackground();
    } catch (error) {
      console.error('Failed to initialize subscription:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load subscription information',
      }));
    }
  };

  const loadProductsInBackground = () => {
    Promise.all([
      loadProduct(SUBSCRIPTION_PRODUCTS.MONTHLY, BASE_PLANS.MONTHLY),
      loadProduct(SUBSCRIPTION_PRODUCTS.YEARLY, BASE_PLANS.YEARLY),
    ]).then(([monthlyProduct, yearlyProduct]) => {
      setState(prev => ({
        ...prev,
        productMonthly: monthlyProduct,
        productYearly: yearlyProduct,
      }));
    }).catch(error => {
      console.error('Failed to load products:', error);
    });
  };

  const loadProduct = async (productId: string, planId: string) => {
    try {
      const product = await NativePurchases.getProduct({
        productIdentifier: productId,
        productType: PURCHASE_TYPE.SUBS,
        ...(Capacitor.getPlatform() === 'android' && { planIdentifier: planId }),
      });
      return product;
    } catch (error) {
      console.error(`Failed to load product ${productId}:`, error);
      return null;
    }
  };

  const purchaseSubscription = async (productId: string, planId: string): Promise<boolean> => {
    if (!isNative) return true; // Web users don't need to purchase

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const result: any = await NativePurchases.purchaseProduct({
        productIdentifier: productId,
        productType: PURCHASE_TYPE.SUBS,
        ...(Capacitor.getPlatform() === 'android' && { planIdentifier: planId }),
      });

      if (result?.transactionId) {
        // Save subscription status to cache
        localStorage.setItem(SUBSCRIPTION_STATUS_KEY, 'subscribed');
        localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

        setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
        return true;
      } else {
        setState(prev => ({ ...prev, isLoading: false, error: 'Purchase failed' }));
        return false;
      }
    } catch (error: any) {
      console.error('Purchase failed:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Purchase failed',
      }));
      return false;
    }
  };

  const purchaseMonthly = () =>
    purchaseSubscription(SUBSCRIPTION_PRODUCTS.MONTHLY, BASE_PLANS.MONTHLY);

  const purchaseYearly = () =>
    purchaseSubscription(SUBSCRIPTION_PRODUCTS.YEARLY, BASE_PLANS.YEARLY);

  const restorePurchases = async (): Promise<boolean> => {
    if (!isNative) return true;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const restoreResult: any = await NativePurchases.restorePurchases();
      const purchases = restoreResult?.purchases || [];

      const hasActiveSubscription = purchases.some(
        (purchase: any) => purchase.productId === SUBSCRIPTION_PRODUCTS.MONTHLY ||
                   purchase.productId === SUBSCRIPTION_PRODUCTS.YEARLY
      );

      // Save subscription status to cache
      if (hasActiveSubscription) {
        localStorage.setItem(SUBSCRIPTION_STATUS_KEY, 'subscribed');
        localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
      } else {
        localStorage.removeItem(SUBSCRIPTION_STATUS_KEY);
        localStorage.removeItem(LAST_CHECK_KEY);
      }

      setState(prev => ({
        ...prev,
        isSubscribed: hasActiveSubscription,
        isLoading: false
      }));

      return hasActiveSubscription;
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to restore purchases',
      }));
      return false;
    }
  };

  const manageSubscriptions = async () => {
    if (!isNative) return;

    try {
      await NativePurchases.manageSubscriptions();
    } catch (error) {
      console.error('Failed to open subscription management:', error);
    }
  };

  return {
    ...state,
    isNative,
    purchaseMonthly,
    purchaseYearly,
    restorePurchases,
    manageSubscriptions,
    refresh: initializeSubscription,
  };
}
