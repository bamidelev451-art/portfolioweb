package com.vikola.aichat;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    // ── Change this to your permanent Render URL once deployed ──────────────
    private static final String WEBSITE_URL = "https://vikola-ai-assistant.onrender.com";
    // ────────────────────────────────────────────────────────────────────────

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefresh;
    private View offlineView;

    // File chooser for image uploads
    private ValueCallback<Uri[]> filePathCallback;
    private final ActivityResultLauncher<Intent> fileChooserLauncher =
        registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (filePathCallback == null) return;
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData());
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        });

    // Runtime permissions
    private PermissionRequest pendingPermissionRequest;
    private final ActivityResultLauncher<String[]> permissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), granted -> {
            if (pendingPermissionRequest != null) {
                List<String> grantedResources = new ArrayList<>();
                if (Boolean.TRUE.equals(granted.get(Manifest.permission.RECORD_AUDIO))) {
                    grantedResources.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                }
                if (Boolean.TRUE.equals(granted.get(Manifest.permission.CAMERA))) {
                    grantedResources.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE);
                }
                if (!grantedResources.isEmpty()) {
                    pendingPermissionRequest.grant(grantedResources.toArray(new String[0]));
                } else {
                    pendingPermissionRequest.deny();
                }
                pendingPermissionRequest = null;
            }
        });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        offlineView = findViewById(R.id.offlineView);

        setupWebView();
        setupSwipeRefresh();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            loadWebsite();
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();

        // Core settings
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Media
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Responsive layout
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        // Cache - load from network, fall back to cache when offline
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // User agent — identify as Vikola Android app
        settings.setUserAgentString(
            settings.getUserAgentString() + " VikolaApp/1.0 Android"
        );

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Keep internal links inside the app
                if (url.startsWith(WEBSITE_URL) || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
                    return false;
                }
                // Open external links in the browser
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
                offlineView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    progressBar.setVisibility(View.GONE);
                    swipeRefresh.setRefreshing(false);
                    webView.setVisibility(View.GONE);
                    offlineView.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            // Progress bar update
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress == 100) progressBar.setVisibility(View.GONE);
            }

            // Microphone & camera permission requests from website
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                pendingPermissionRequest = request;
                List<String> androidPerms = new ArrayList<>();
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                        androidPerms.add(Manifest.permission.RECORD_AUDIO);
                    } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        androidPerms.add(Manifest.permission.CAMERA);
                    }
                }
                if (!androidPerms.isEmpty()) {
                    List<String> toRequest = new ArrayList<>();
                    for (String perm : androidPerms) {
                        if (ContextCompat.checkSelfPermission(MainActivity.this, perm)
                                != PackageManager.PERMISSION_GRANTED) {
                            toRequest.add(perm);
                        }
                    }
                    if (toRequest.isEmpty()) {
                        // All permissions already granted
                        request.grant(request.getResources());
                        pendingPermissionRequest = null;
                    } else {
                        permissionLauncher.launch(toRequest.toArray(new String[0]));
                    }
                } else {
                    request.deny();
                    pendingPermissionRequest = null;
                }
            }

            // File chooser for image uploads
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                              FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                fileChooserLauncher.launch(intent);
                return true;
            }

            // Console log forwarding (useful for debugging)
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return true;
            }
        });

        // Enable WebView debugging in debug builds
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }

    private void setupSwipeRefresh() {
        swipeRefresh.setColorSchemeColors(
            getResources().getColor(R.color.purple_200, getTheme())
        );
        swipeRefresh.setOnRefreshListener(this::loadWebsite);
    }

    private void loadWebsite() {
        webView.loadUrl(WEBSITE_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
