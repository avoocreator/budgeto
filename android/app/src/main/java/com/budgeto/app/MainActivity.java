package com.budgeto.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class); // harus sebelum super.onCreate
        super.onCreate(savedInstanceState);
    }
}