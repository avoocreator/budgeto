package com.budgeto.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Budgeto Widget 4x2 — 100% lokal.
 * Data datang dari snapshot yang didorong app lewat WidgetBridgePlugin
 * (SharedPreferences). Widget tidak pernah memanggil jaringan.
 *
 * v2: warna & style mengikuti tema aplikasi — snapshot membawa
 * theme.schemaId (mocha|emerald|aqua|sunset|lavender) dan theme.colors
 * (palet final hasil schema + mode + tone dari lib/themes.ts).
 */
public class BudgetoWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "budgeto_widget";
    static final String KEY_SNAPSHOT = "snapshot";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    /** Dipanggil plugin setiap kali app mengirim snapshot baru. */
    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, BudgetoWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, buildViews(context));
        }
    }

    private static RemoteViews buildViews(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_budgeto);

        // ── Baca snapshot ──
        JSONObject snap = null;
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SNAPSHOT, null);
            if (raw != null) snap = new JSONObject(raw);
        } catch (Exception ignored) { /* snapshot rusak → tampil keadaan kosong */ }

        boolean dark = snap == null || !"light".equals(optNested(snap, "theme", "mode", "dark"));
        boolean id = snap == null || !"en".equals(snap.optString("locale", "id"));
        String preset = snap == null ? "emerald" : optNested(snap, "theme", "preset", "emerald");
        String schemaId = snap == null ? "" : optNested(snap, "theme", "schemaId", "");

        // ── Warna per tema (v2 dari theme.colors, fallback ke legacy) ──
        JSONObject colors = null;
        JSONObject theme = snap == null ? null : snap.optJSONObject("theme");
        if (theme != null) colors = theme.optJSONObject("colors");

        int textPrimary = readColor(colors, "text", dark ? "#FFFFFF" : "#0E1512");
        int textMuted   = readColor(colors, "textMuted", dark ? "#99FFFFFF" : "#990E1512");
        int accent      = readColor(colors, "accent", String.format("#%06X", 0xFFFFFF & accentColor(preset, dark)));
        int warn        = readColor(colors, "warn", dark ? "#FBBF24" : "#B45309");
        int bad         = readColor(colors, "bad", dark ? "#FB7185" : "#E11D48");
        int incomeC     = readColor(colors, "income", dark ? "#34D399" : "#059669");
        int expenseC    = readColor(colors, "expense", dark ? "#FB7185" : "#E11D48");

        // Background gradient: pilih drawable sesuai schema + mode (fallback emerald)
        int bgRes = context.getResources().getIdentifier(
                "widget_bg_" + (schemaId.isEmpty() ? "emerald" : schemaId) + "_" + (dark ? "dark" : "light"),
                "drawable", context.getPackageName());
        if (bgRes == 0) bgRes = dark ? R.drawable.widget_bg_emerald_dark : R.drawable.widget_bg_emerald_light;
        v.setInt(R.id.widget_root, "setBackgroundResource", bgRes);

        v.setTextColor(R.id.widget_brand, accent);
        v.setTextColor(R.id.widget_updated, textMuted);
        v.setTextColor(R.id.widget_label, textMuted);
        v.setTextColor(R.id.widget_meta_left, textMuted);
        v.setTextColor(R.id.widget_meta_right, textMuted);
        v.setTextColor(R.id.widget_btn_expense, expenseC);
        v.setTextColor(R.id.widget_btn_income, incomeC);

        // ── Isi ──
        String label, amount, metaLeft = "", metaRight = "", updated = "";
        int amountColor = textPrimary;
        int barPercent = 0;
        String barKind = "none"; // none | ok | warn | bad

        JSONObject labels = snap == null ? null : snap.optJSONObject("labels");
        String btnExpense = labels != null ? labels.optString("addExpense", id ? "− Keluar" : "− Expense") : (id ? "− Keluar" : "− Expense");
        String btnIncome = labels != null ? labels.optString("addIncome", id ? "+ Masuk" : "+ Income") : (id ? "+ Masuk" : "+ Income");
        v.setTextViewText(R.id.widget_btn_expense, btnExpense);
        v.setTextViewText(R.id.widget_btn_income, btnIncome);

        if (snap == null) {
            label = id ? "Belum ada data" : "No data yet";
            amount = id ? "Buka Budgeto" : "Open Budgeto";
        } else {
            boolean privacy = snap.optBoolean("privacy", false);
            JSONObject daily = snap.optJSONObject("daily");
            JSONObject budget = snap.optJSONObject("budget");
            double balance = snap.optDouble("balance", 0);
            String status = daily == null ? "none" : daily.optString("status", "none");
            String balLabel = labels != null ? labels.optString("balance", id ? "Saldo" : "Balance") : (id ? "Saldo" : "Balance");

            updated = formatUpdated(snap.optString("updatedAt", ""));

            if ("none".equals(status) || daily == null) {
                // Budget belum diatur → tampilkan saldo sebagai utama
                label = balLabel;
                amount = money(balance, privacy);
                metaLeft = id ? "Atur budget untuk lihat sisa harian" : "Set a budget to see daily allowance";
            } else {
                label = labels != null ? labels.optString("today", id ? "Sisa hari ini" : "Today's allowance") : (id ? "Sisa hari ini" : "Today's allowance");
                amount = money(daily.optDouble("amount", 0), privacy);
                barPercent = Math.max(0, Math.min(100, budget == null ? 0 : budget.optInt("usedPercent", 0)));
                barKind = status;
                if ("warn".equals(status)) amountColor = warn;
                if ("bad".equals(status)) amountColor = bad;
                metaLeft = barPercent + "% " + (id ? "budget terpakai" : "budget used");
                metaRight = balLabel + " " + money(balance, privacy);
            }
        }

        v.setTextViewText(R.id.widget_label, label);
        v.setTextViewText(R.id.widget_amount, amount);
        v.setTextColor(R.id.widget_amount, amountColor);
        v.setTextViewText(R.id.widget_meta_left, metaLeft);
        v.setTextViewText(R.id.widget_meta_right, metaRight);
        v.setTextViewText(R.id.widget_updated, updated);

        // Satu bar aktif sesuai status (warna bar tidak bisa diubah dinamis di RemoteViews)
        v.setViewVisibility(R.id.widget_bar_ok, "ok".equals(barKind) ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.widget_bar_warn, "warn".equals(barKind) ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.widget_bar_bad, "bad".equals(barKind) ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.widget_bar_space, "none".equals(barKind) ? View.VISIBLE : View.GONE);
        if ("ok".equals(barKind)) v.setProgressBar(R.id.widget_bar_ok, 100, barPercent, false);
        if ("warn".equals(barKind)) v.setProgressBar(R.id.widget_bar_warn, 100, barPercent, false);
        if ("bad".equals(barKind)) v.setProgressBar(R.id.widget_bar_bad, 100, barPercent, false);

        // ── Klik ──
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;

        Intent openApp = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openApp != null) {
            v.setOnClickPendingIntent(R.id.widget_top, PendingIntent.getActivity(context, 10, openApp, flags));
        }

        Intent expense = new Intent(Intent.ACTION_VIEW, Uri.parse("budgeto://add?type=expense"));
        expense.setPackage(context.getPackageName());
        v.setOnClickPendingIntent(R.id.widget_btn_expense, PendingIntent.getActivity(context, 11, expense, flags));

        Intent income = new Intent(Intent.ACTION_VIEW, Uri.parse("budgeto://add?type=income"));
        income.setPackage(context.getPackageName());
        v.setOnClickPendingIntent(R.id.widget_btn_income, PendingIntent.getActivity(context, 12, income, flags));

        return v;
    }

    private static String optNested(JSONObject o, String key, String sub, String def) {
        JSONObject n = o.optJSONObject(key);
        return n == null ? def : n.optString(sub, def);
    }

    /** Baca warna hex dari theme.colors (snapshot v2); fallback bila tidak ada. */
    private static int readColor(JSONObject colors, String key, String fallbackHex) {
        try {
            String v = colors == null ? null : colors.optString(key, null);
            if (v != null && !v.isEmpty()) return Color.parseColor(v);
        } catch (Exception ignored) { /* format warna rusak → fallback */ }
        return Color.parseColor(fallbackHex);
    }

    /** Overload: fallback sudah berupa int (mis. hasil accentColor). */
    private static int readColor(JSONObject colors, String key, int fallback) {
        try {
            String v = colors == null ? null : colors.optString(key, null);
            if (v != null && !v.isEmpty()) return Color.parseColor(v);
        } catch (Exception ignored) { /* format warna rusak → fallback */ }
        return fallback;
    }

    private static int accentColor(String preset, boolean dark) {
        switch (preset) {
            case "aqua":   return Color.parseColor(dark ? "#22D3EE" : "#0E7490");
            case "sunset": return Color.parseColor(dark ? "#FB923C" : "#EA580C");
            case "lavender": return Color.parseColor(dark ? "#A78BFA" : "#7C3AED");
            case "mocha":  return Color.parseColor(dark ? "#D8A679" : "#8B5E3C");
            case "ocean":  return Color.parseColor(dark ? "#22D3EE" : "#0891B2");
            case "violet": return Color.parseColor(dark ? "#A78BFA" : "#7C3AED");
            case "rose":   return Color.parseColor(dark ? "#FB7185" : "#E11D48");
            case "gold":   return Color.parseColor(dark ? "#FBBF24" : "#B45309");
            default:       return Color.parseColor(dark ? "#34D399" : "#059669");
        }
    }

    private static String money(double value, boolean privacy) {
        if (privacy) return "Rp ••••";
        NumberFormat nf = NumberFormat.getNumberInstance(new Locale("id", "ID"));
        nf.setMaximumFractionDigits(0);
        return (value < 0 ? "-" : "") + "Rp" + nf.format(Math.abs(value));
    }

    /** ISO UTC dari JS (toISOString) → "HH:mm" lokal, atau "dd/MM HH:mm" bila bukan hari ini. */
    private static String formatUpdated(String iso) {
        try {
            if (iso == null || iso.length() < 19) return "";
            SimpleDateFormat in = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            in.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = in.parse(iso.substring(0, 19));
            if (d == null) return "";
            SimpleDateFormat day = new SimpleDateFormat("yyyyMMdd", Locale.US);
            boolean today = day.format(d).equals(day.format(new Date()));
            return new SimpleDateFormat(today ? "HH:mm" : "dd/MM HH:mm", Locale.US).format(d);
        } catch (Exception e) {
            return "";
        }
    }
}
