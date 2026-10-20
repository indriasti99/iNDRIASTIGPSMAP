/**
 * Setup script for Capacitor Android project
 * Automatically ensures AndroidManifest.xml, NativeGalleryPlugin,
 * and build.gradle have proper permissions and Java 17 configuration.
 */
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const androidDir = path.join(rootDir, 'android');
const appDir = path.join(androidDir, 'app');
const mainDir = path.join(appDir, 'src', 'main');
const javaDir = path.join(mainDir, 'java', 'com', 'indriasti', 'gpsmap');
const manifestPath = path.join(mainDir, 'AndroidManifest.xml');
const appBuildGradlePath = path.join(appDir, 'build.gradle');

console.log('--- Configuring Android Native Files ---');

// 1. Ensure directories exist
if (!fs.existsSync(javaDir)) {
  fs.mkdirSync(javaDir, { recursive: true });
}

// 2. AndroidManifest.xml with all required permissions
const manifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Network -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Camera Hardware & Features -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.FLASHLIGHT" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.camera.flash" android:required="false" />

    <!-- Location GNSS & Features -->
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />

    <!-- Storage / Media Gallery -->
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:requestLegacyExternalStorage="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/AppTheme">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
    </application>

</manifest>
`;

fs.writeFileSync(manifestPath, manifestContent, 'utf8');
console.log('✓ AndroidManifest.xml updated with Camera and GPS permissions');

// 3. NativeGalleryPlugin.java
const pluginContent = `package com.indriasti.gpsmap;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "NativeGallery")
public class NativeGalleryPlugin extends Plugin {

    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String base64Data = call.getString("base64");
        String fileName = call.getString("fileName");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("base64 data is required");
            return;
        }

        if (fileName == null || fileName.isEmpty()) {
            fileName = "GEO_" + System.currentTimeMillis() + ".jpg";
        }

        try {
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);

            Context context = getContext();
            ContentResolver resolver = context.getContentResolver();
            Uri imageUri = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/iNDRIASTIGPSMAP");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (imageUri == null) {
                    call.reject("Failed to create MediaStore entry");
                    return;
                }

                try (OutputStream os = resolver.openOutputStream(imageUri)) {
                    if (os != null) {
                        os.write(imageBytes);
                        os.flush();
                    } else {
                        call.reject("Failed to open output stream");
                        return;
                    }
                }

                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(imageUri, values, null, null);
            } else {
                File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                File albumDir = new File(picturesDir, "iNDRIASTIGPSMAP");
                if (!albumDir.exists()) {
                    albumDir.mkdirs();
                }
                File imageFile = new File(albumDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                    fos.write(imageBytes);
                    fos.flush();
                }

                MediaScannerConnection.scanFile(context, new String[]{imageFile.getAbsolutePath()}, new String[]{"image/jpeg"}, null);
                imageUri = Uri.fromFile(imageFile);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("fileName", fileName);
            ret.put("bytesWritten", imageBytes.length);
            ret.put("uri", imageUri != null ? imageUri.toString() : "");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error saving image to gallery: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error opening location settings: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        try {
            LocationManager locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            boolean isGpsEnabled = false;
            boolean isNetworkEnabled = false;

            if (locationManager != null) {
                try {
                    isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
                } catch (Exception ignored) {}
                try {
                    isNetworkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
                } catch (Exception ignored) {}
            }

            JSObject ret = new JSObject();
            ret.put("enabled", isGpsEnabled || isNetworkEnabled);
            ret.put("gps", isGpsEnabled);
            ret.put("network", isNetworkEnabled);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error checking location status: " + e.getMessage(), e);
        }
    }
}
`;

fs.writeFileSync(path.join(javaDir, 'NativeGalleryPlugin.java'), pluginContent, 'utf8');
console.log('✓ NativeGalleryPlugin.java created');

// 4. MainActivity.java
const mainActivityContent = `package com.indriasti.gpsmap;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGalleryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;

fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), mainActivityContent, 'utf8');
console.log('✓ MainActivity.java created');

// 5. Update app/build.gradle with Java 17 compile options
if (fs.existsSync(appBuildGradlePath)) {
  let gradleContent = fs.readFileSync(appBuildGradlePath, 'utf8');
  if (!gradleContent.includes('JavaVersion.VERSION_17')) {
    gradleContent = gradleContent.replace(
      /defaultConfig\s*\{[\s\S]*?\}/,
      (match) => `${match}\n    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }`
    );
    fs.writeFileSync(appBuildGradlePath, gradleContent, 'utf8');
    console.log('✓ app/build.gradle configured for Java 17');
  }
}

console.log('--- Android Native Configuration Done! ---');
