package com.budgeto.app;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void push(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null || snapshot.isEmpty()) {
            call.reject("snapshot kosong");
            return;
        }
        Context ctx = getContext();
        ctx.getSharedPreferences(BudgetoWidgetProvider.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(BudgetoWidgetProvider.KEY_SNAPSHOT, snapshot)
                .apply();
        BudgetoWidgetProvider.updateAll(ctx);
        call.resolve();
    }
}