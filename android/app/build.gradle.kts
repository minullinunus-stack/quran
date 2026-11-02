plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The APK includes the website, but must not offer to download itself.
val syncWebsiteAssets by tasks.registering(Sync::class) {
    from(rootProject.projectDir.parentFile) {
        include("index.html", "privacy.html", "manifest.webmanifest", "sw.js", "icons/**")
    }
    into("src/main/assets/www")
    doLast {
        val page = file("src/main/assets/www/index.html")
        page.writeText(page.readText().replace(
            Regex("""(?m)^.*<a class="download-app"[^\n]*</a>\r?\n?"""), ""
        ))
    }
}

tasks.named("preBuild") { dependsOn(syncWebsiteAssets) }

android {
    namespace = "ru.hatam.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ru.hatam.app"
        minSdk = 23
        targetSdk = 35
        versionCode = 3
        versionName = "1.2.0"
    }

    val distributionKeystore = System.getenv("HATAM_KEYSTORE")
    if (!distributionKeystore.isNullOrBlank()) {
        signingConfigs {
            create("distribution") {
                storeFile = file(distributionKeystore)
                storePassword = System.getenv("HATAM_STORE_PASSWORD")
                keyAlias = System.getenv("HATAM_KEY_ALIAS") ?: "hatam"
                keyPassword = System.getenv("HATAM_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            if (!distributionKeystore.isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("distribution")
            }
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
