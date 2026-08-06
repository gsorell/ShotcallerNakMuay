package com.shotcallernakmuay.app;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * InstallInfoPlugin: exposes when this app was FIRST installed on this device.
 *
 * This is the Android counterpart to StoreKit's `originalApplicationVersion`,
 * and it exists to solve the paid-to-free grandfathering problem.
 *
 * Google Play keeps no retroactive record of who bought a paid app once that
 * app becomes free, so the migration relies on stamping owners while the app
 * is still paid. That stamp requires the user to OPEN the app before the price
 * flip — and anyone whose device auto-updates to the free build first would
 * never be stamped, and would hit a paywall despite having paid.
 *
 * `firstInstallTime` closes that gap: it survives app updates (only
 * `lastUpdateTime` moves), so if a device installed this app before the price
 * flip, the app cost money at that moment and that user paid for it.
 *
 * Known limits, handled elsewhere in the entitlement layer:
 *   - A reinstall, or an install on a NEW device, resets firstInstallTime.
 *     Those users fall back to Android Auto Backup restoring the stamp, or to
 *     the manual prior-purchase claim.
 *   - Google Play Family Library members share a purchase without buying it
 *     individually; grandfathering them is intentional.
 */
@CapacitorPlugin(name = "InstallInfo")
public class InstallInfoPlugin extends Plugin {

  /**
   * Resolves `{ firstInstallTime: <epoch millis> }`.
   *
   * Returns 0 if the value cannot be read, which callers must treat as
   * "unknown" and NOT as "installed at the epoch" — otherwise a lookup failure
   * would grandfather everybody.
   */
  @PluginMethod
  public void getFirstInstallTime(PluginCall call) {
    JSObject result = new JSObject();
    long firstInstallTime = 0L;

    try {
      PackageManager pm = getContext().getPackageManager();
      PackageInfo info = pm.getPackageInfo(getContext().getPackageName(), 0);
      firstInstallTime = info.firstInstallTime;
    } catch (PackageManager.NameNotFoundException e) {
      // Cannot happen for our own package, but the API forces the check.
      firstInstallTime = 0L;
    } catch (Exception e) {
      firstInstallTime = 0L;
    }

    result.put("firstInstallTime", firstInstallTime);
    call.resolve(result);
  }
}
