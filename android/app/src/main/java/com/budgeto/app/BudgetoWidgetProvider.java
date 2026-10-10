package com.budgeto.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.NumberFormat;
import java.util.Locale;

/**
 * Budgeto Widget — saldo + tombol cepat catat transaksi.
 *
 * - Tombol "Keluar"/"Masuk" membuka aplikasi langsung ke form tambah transaksi (deep link budgeto://add)
 * - Saldo diambil dari Supabase (tabel widget_summary) bila dikonfigurasi saat build (gradle properties).
 *   Bila belum dikonfigurasi, widget tetap berfungsi sebagai tombol pintas.
 */
public class BudgetoWidgetProvider extends AppWidgetProvider {

    private static final String ACTION_REFRESH = "com.budgeto.app.WIDGET_REFRESH";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context, "Budgeto", "Memuat…"));
        }
        refreshData(context, manager);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            refreshData(context, AppWidgetManager.getInstance(context));
        }
    }

    private RemoteViews buildViews(Context context, String balance, String subtitle) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_budgeto);
        views.setTextViewText(R.id.widget_balance, balance);
        views.setTextViewText(R.id.widget_subtitle, subtitle);

        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;

        // Klik area atas → buka aplikasi
        Intent openApp = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openApp != null) {
            PendingIntent pi = PendingIntent.getActivity(context, 10, openApp, flags);
            views.setOnClickPendingIntent(R.id.widget_top, pi);
        }

        // Tombol cepat → deep link ke form tambah transaksi
        Intent expense = new Intent(Intent.ACTION_VIEW, Uri.parse("budgeto://add?type=expense"));
        expense.setPackage(context.getPackageName());
        views.setOnClickPendingIntent(R.id.widget_btn_expense, PendingIntent.getActivity(context, 11, expense, flags));

        Intent income = new Intent(Intent.ACTION_VIEW, Uri.parse("budgeto://add?type=income"));
        income.setPackage(context.getPackageName());
        views.setOnClickPendingIntent(R.id.widget_btn_income, PendingIntent.getActivity(context, 12, income, flags));

        // Tombol refresh
        Intent refresh = new Intent(context, BudgetoWidgetProvider.class);
        refresh.setAction(ACTION_REFRESH);
        views.setOnClickPendingIntent(R.id.widget_refresh, PendingIntent.getBroadcast(context, 13, refresh, flags));

        return views;
    }

    private void refreshData(final Context context, final AppWidgetManager manager) {
        final String url = BuildConfig.SUPABASE_URL;
        final String key = BuildConfig.SUPABASE_ANON_KEY;
        final String token = BuildConfig.WIDGET_TOKEN;
        final int[] ids = manager.getAppWidgetIds(new ComponentName(context, BudgetoWidgetProvider.class));

        if (url == null || url.trim().isEmpty() || key == null || key.trim().isEmpty() || token == null || token.trim().isEmpty()) {
            for (int id : ids) {
                manager.updateAppWidget(id, buildViews(context, "Budgeto", "Saldo cloud belum diatur — tombol tetap jalan"));
            }
            return;
        }

        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                String balanceText = "Budgeto";
                String subtitle = "Mengambil data…";
                try {
                    HttpURLConnection conn = (HttpURLConnection) new URL(
                            url + "/rest/v1/widget_summary?select=balance,month_income,month_expense&limit=1")
                            .openConnection();
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("apikey", key);
                    conn.setRequestProperty("Authorization", "Bearer " + key);
                    conn.setRequestProperty("x-widget-token", token);
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);

                    int code = conn.getResponseCode();
                    if (code == 200) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) sb.append(line);
                        reader.close();

                        JSONArray arr = new JSONArray(sb.toString());
                        if (arr.length() > 0) {
                            JSONObject row = arr.getJSONObject(0);
                            double bal = row.optDouble("balance", 0);
                            double inc = row.optDouble("month_income", 0);
                            double exp = row.optDouble("month_expense", 0);
                            balanceText = formatIdr(bal);
                            subtitle = "Masuk " + formatIdr(inc) + " · Keluar " + formatIdr(exp);
                        } else {
                            subtitle = "Belum tersinkron — buka app dulu";
                        }
                    } else {
                        subtitle = "Gagal memuat (HTTP " + code + ")";
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    subtitle = "Offline / koneksi bermasalah";
                }

                final String b = balanceText;
                final String s = subtitle;
                android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
                final int[] widgetIds = ids;
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        for (int id : widgetIds) {
                            manager.updateAppWidget(id, buildViews(context, b, s));
                        }
                    }
                });
            }
        });
        t.start();
    }

    private String formatIdr(double value) {
        NumberFormat nf = NumberFormat.getNumberInstance(new Locale("in", "ID"));
        nf.setMaximumFractionDigits(0);
        String sign = value < 0 ? "-" : "";
        return sign + "Rp" + nf.format(Math.abs(value));
    }
}
