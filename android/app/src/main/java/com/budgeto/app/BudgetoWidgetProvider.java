package com.budgeto.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Widget 4x2 Budgeto — total saldo, ringkasan periode, dan aksi cepat. */
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

        // Baca snapshot
        JSONObject snap = null;
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SNAPSHOT, null);
            if (raw != null) snap = new JSONObject(raw);
        } catch (Exception ignored) { /* snapshot rusak → tampil keadaan kosong */ }

        boolean dark = snap == null || !"light".equals(optNested(snap, "theme", "mode", "dark"));
        boolean id = snap == null || !"en".equals(snap.optString("locale", "id"));
        String preset = snap == null ? "emerald" : optNested(snap, "theme", "preset", "emerald");
        String schemaId = snap == null ? "" : optNested(snap, "theme", "schemaId", "");
        if (schemaId.isEmpty()) schemaId = "emerald";
        String mode = dark ? "dark" : "light";

        // Warna per tema
        JSONObject colors = null;
        JSONObject theme = snap == null ? null : snap.optJSONObject("theme");
        if (theme != null) colors = theme.optJSONObject("colors");

        int textPrimary = readColor(colors, "text", dark ? "#ECF1EE" : "#101613");
        int textMuted   = readColor(colors, "textMuted", dark ? "#8A958F" : "#69736E");
        int accent      = readColor(colors, "accent", accentColor(preset, dark));
        int accentOn    = readColor(colors, "accentContrast", dark ? "#04241A" : "#FFFFFF");
        int incomeC     = readColor(colors, "income", dark ? "#3ECF8E" : "#12814F");
        int expenseC    = readColor(colors, "expense", dark ? "#F27A89" : "#D92D43");
        int bad         = readColor(colors, "bad", dark ? "#F27A89" : "#D92D43");

        // Background & tombol: drawable per schema + mode (fallback emerald)
        v.setInt(R.id.widget_root, "setBackgroundResource",
                drawableFor(context, "widget_bg_", schemaId, mode, dark ? R.drawable.widget_bg_emerald_dark : R.drawable.widget_bg_emerald_light));
        v.setInt(R.id.widget_btn_expense, "setBackgroundResource",
                drawableFor(context, "widget_btn_primary_", schemaId, mode, dark ? R.drawable.widget_btn_primary_emerald_dark : R.drawable.widget_btn_primary_emerald_light));
        v.setInt(R.id.widget_btn_income, "setBackgroundResource",
                drawableFor(context, "widget_btn_secondary_", schemaId, mode, dark ? R.drawable.widget_btn_secondary_emerald_dark : R.drawable.widget_btn_secondary_emerald_light));

        v.setInt(R.id.widget_dot, "setColorFilter", accent);
        v.setTextColor(R.id.widget_label, textMuted);
        v.setTextColor(R.id.widget_updated, textMuted);
        v.setTextColor(R.id.widget_meta_in, textMuted);
        v.setTextColor(R.id.widget_meta_out, textMuted);
        v.setTextColor(R.id.widget_btn_expense, accentOn);
        v.setTextColor(R.id.widget_btn_income, textPrimary);

        // Isi data widget
        String label = id ? "Total saldo" : "Total balance";
        String amount;
        String updated = "";
        int amountColor = textPrimary;
        CharSequence metaIn;
        CharSequence metaOut;
        String inLabel = id ? "Masuk" : "In";
        String outLabel = id ? "Keluar" : "Out";

        JSONObject labels = snap == null ? null : snap.optJSONObject("labels");
        String btnExpense = labels != null ? labels.optString("addExpense", id ? "− Keluar" : "− Expense") : (id ? "− Keluar" : "− Expense");
        String btnIncome = labels != null ? labels.optString("addIncome", id ? "+ Masuk" : "+ Income") : (id ? "+ Masuk" : "+ Income");
        v.setTextViewText(R.id.widget_btn_expense, btnExpense);
        v.setTextViewText(R.id.widget_btn_income, btnIncome);

        if (snap == null) {
            amount = id ? "Buka Budgeto" : "Open Budgeto";
            metaIn = metaText(inLabel, "—", incomeC);
            metaOut = metaText(outLabel, "—", expenseC);
        } else {
            boolean privacy = snap.optBoolean("privacy", false);
            double balance = snap.optDouble("balance", 0);
            JSONObject period = snap.optJSONObject("period");

            label = labels != null ? labels.optString("balance", label) : label;
            amount = money(balance, privacy);
            if (!privacy && balance < 0) amountColor = bad;
            updated = formatUpdated(snap.optString("updatedAt", ""));

            if (period != null) {
                metaIn = metaText(inLabel, moneyCompact(period.optDouble("income", 0), privacy, id), incomeC);
                metaOut = metaText(outLabel, moneyCompact(period.optDouble("expense", 0), privacy, id), expenseC);
            } else {
                metaIn = metaText(inLabel, "—", incomeC);
                metaOut = metaText(outLabel, "—", expenseC);
            }
        }

        v.setTextViewText(R.id.widget_label, label);
        v.setTextViewText(R.id.widget_amount, amount);
        v.setTextColor(R.id.widget_amount, amountColor);
        v.setTextViewText(R.id.widget_meta_in, metaIn);
        v.setTextViewText(R.id.widget_meta_out, metaOut);
        v.setTextViewText(R.id.widget_updated, updated);

        // Aksi klik
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

    /** Cari drawable "<prefix><schema>_<mode>"; pakai fallback bila tidak ada. */
    private static int drawableFor(Context context, String prefix, String schemaId, String mode, int fallback) {
        int res = context.getResources().getIdentifier(prefix + schemaId + "_" + mode, "drawable", context.getPackageName());
        return res == 0 ? fallback : res;
    }

    /** "Masuk  Rp8,5jt" — label ikut warna TextView, nilai ditebalkan & diwarnai. */
    private static CharSequence metaText(String label, String value, int valueColor) {
        SpannableStringBuilder sb = new SpannableStringBuilder();
        sb.append(label).append("  ");
        int start = sb.length();
        sb.append(value);
        sb.setSpan(new ForegroundColorSpan(valueColor), start, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        sb.setSpan(new StyleSpan(Typeface.BOLD), start, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return sb;
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
            default:       return Color.parseColor(dark ? "#3ECF8E" : "#12814F");
        }
    }

    private static String money(double value, boolean privacy) {
        if (privacy) return "Rp ••••";
        NumberFormat nf = NumberFormat.getNumberInstance(new Locale("id", "ID"));
        nf.setMaximumFractionDigits(0);
        return (value < 0 ? "-" : "") + "Rp" + nf.format(Math.abs(value));
    }

    /** Versi ringkas untuk baris meta: Rp850rb, Rp8,5jt, Rp1,2M (id) / Rp850K, Rp8.5M, Rp1.2B (en). */
    private static String moneyCompact(double value, boolean privacy, boolean id) {
        if (privacy) return "••••";
        double abs = Math.abs(value);
        String sign = value < 0 ? "-" : "";
        if (abs >= 1_000_000_000d) return sign + "Rp" + oneDecimal(abs / 1_000_000_000d, id) + (id ? "M" : "B");
        if (abs >= 1_000_000d) return sign + "Rp" + oneDecimal(abs / 1_000_000d, id) + (id ? "jt" : "M");
        if (abs >= 1_000d) return sign + "Rp" + oneDecimal(abs / 1_000d, id) + (id ? "rb" : "K");
        return sign + "Rp" + Math.round(abs);
    }

    private static String oneDecimal(double n, boolean id) {
        NumberFormat nf = NumberFormat.getNumberInstance(id ? new Locale("id", "ID") : Locale.US);
        nf.setMaximumFractionDigits(1);
        nf.setMinimumFractionDigits(0);
        return nf.format(n);
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
