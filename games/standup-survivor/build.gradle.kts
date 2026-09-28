// Standup Survivor: Kotlin Multiplatform.
//   commonMain  the game itself (rules, enemies, upgrades), plain Kotlin
//   jsMain      the browser: canvas drawing, input, theme and language, compiled to JavaScript
//   commonTest  tests, run on the JVM (fast, no browser needed): ./gradlew jvmTest
// ./gradlew jsBrowserDistribution builds the page into build/dist/js/productionExecutable/.
plugins {
    kotlin("multiplatform") version "2.4.20"
}

kotlin {
    jvmToolchain(21)

    jvm()

    js {
        browser {
            commonWebpackConfig {
                outputFileName = "standup.js"
            }
        }
        binaries.executable()
    }

    sourceSets {
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}
