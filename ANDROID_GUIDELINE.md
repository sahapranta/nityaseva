# Nityaseva Android App — Complete Development Guideline

## Overview

A native Kotlin Android app that mirrors the Nityaseva desktop app's core features.
Uses libSQL Android SDK for offline-first data with Turso cloud sync.
Targets Android 8.0+ (API 26). Distributed via direct APK sideload.

---

## 1. Project Setup

### Create project in Android Studio
- Template: **Empty Activity**
- Language: **Kotlin**
- Minimum SDK: **API 26 (Android 8.0)**
- Package: `com.prantasaha.nityaseva`
- Build system: **Gradle (Kotlin DSL)**

### Project structure
```
app/
  src/main/
    java/com/prantasaha/nityaseva/
      data/
        db/          ← LibSQL database layer
        model/       ← Data classes
        repository/  ← Data access layer
      ui/
        splash/      ← Splash + config screen
        auth/        ← Login screen
        dashboard/   ← Dashboard
        members/     ← Members CRUD
        donations/   ← Donation recording
        contacts/    ← Phonebook-style contacts
        settings/    ← Sync settings
        shared/      ← Shared composables
      util/
        crypto/      ← AES-GCM + bcrypt
        receipt/     ← PNG receipt generator
      MainActivity.kt
      NityasevaApp.kt
    res/
      drawable/      ← logo.png, splash assets
      values/        ← colors.xml, strings.xml, themes.xml
```

---

## 2. Dependencies (`app/build.gradle.kts`)

```kotlin
dependencies {
    // libSQL Android
    implementation("tech.turso.libsql:libsql:0.4.0")

    // Jetpack Compose (UI)
    implementation(platform("androidx.compose:compose-bom:2024.05.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // ViewModel + Lifecycle
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    // Encrypted SharedPreferences
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Coil (image loading)
    implementation("io.coil-kt:coil-compose:2.6.0")

    // bcrypt
    implementation("at.favre.lib:bcrypt:0.10.2")

    // AES-GCM is built into Android — no extra dependency needed

    // Canvas/bitmap for receipt PNG
    implementation("androidx.core:core-ktx:1.13.1")
}
```

---

## 3. Color Theme (`res/values/colors.xml`)

Match the desktop saffron/maroon palette exactly.

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Saffron brand -->
    <color name="saffron_50">#FFF8ED</color>
    <color name="saffron_100">#FFEECF</color>
    <color name="saffron_500">#F97C08</color>
    <color name="saffron_600">#DE5D04</color>
    <color name="saffron_700">#B84007</color>

    <!-- Surfaces -->
    <color name="surface_0">#F5F4F1</color>
    <color name="surface_1">#ECEAE5</color>
    <color name="surface_2">#FFFFFF</color>
    <color name="surface_3">#F0EDE8</color>
    <color name="border">#D0CCC3</color>

    <!-- Text -->
    <color name="text_primary">#18160F</color>
    <color name="text_secondary">#4A4640</color>
    <color name="text_muted">#7A756C</color>

    <!-- Semantic -->
    <color name="success">#1E6B22</color>
    <color name="danger">#B91C1C</color>
    <color name="warning">#C44E00</color>
    <color name="info">#1251A3</color>
</resources>
```

### Compose theme (`ui/theme/Theme.kt`)

```kotlin
val NityasevaColors = lightColorScheme(
    primary         = Color(0xFFDE5D04),   // saffron_600
    onPrimary       = Color.White,
    primaryContainer = Color(0xFFFFF8ED),  // saffron_50
    secondary       = Color(0xFFB84007),   // saffron_700
    background      = Color(0xFFF5F4F1),   // surface_0
    surface         = Color(0xFFFFFFFF),   // surface_2
    surfaceVariant  = Color(0xFFF0EDE8),   // surface_3
    outline         = Color(0xFFD0CCC3),   // border
    onBackground    = Color(0xFF18160F),   // text_primary
    onSurface       = Color(0xFF18160F),
    error           = Color(0xFFB91C1C),
)

@Composable
fun NityasevaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = NityasevaColors,
        typography = Typography(
            // Use Noto Sans to match desktop
            bodyLarge  = TextStyle(fontFamily = FontFamily.Default, fontSize = 16.sp),
            bodyMedium = TextStyle(fontFamily = FontFamily.Default, fontSize = 14.sp),
            bodySmall  = TextStyle(fontFamily = FontFamily.Default, fontSize = 12.sp),
        ),
        content = content
    )
}
```

---

## 4. Encrypted Credential Storage (`util/SecurePrefs.kt`)

```kotlin
object SecurePrefs {
    private const val PREFS_NAME = "nityaseva_secure"
    private const val KEY_TURSO_URL   = "turso_url"
    private const val KEY_TURSO_TOKEN = "turso_token"

    private fun getPrefs(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveTursoConfig(context: Context, url: String, token: String) {
        getPrefs(context).edit()
            .putString(KEY_TURSO_URL, url)
            .putString(KEY_TURSO_TOKEN, token)
            .apply()
    }

    fun getTursoUrl(context: Context): String? =
        getPrefs(context).getString(KEY_TURSO_URL, null)

    fun getTursoToken(context: Context): String? =
        getPrefs(context).getString(KEY_TURSO_TOKEN, null)

    fun isConfigured(context: Context): Boolean =
        getTursoUrl(context) != null && getTursoToken(context) != null

    fun clear(context: Context) =
        getPrefs(context).edit().clear().apply()
}
```

---

## 5. Database Layer (`data/db/DatabaseManager.kt`)

```kotlin
object DatabaseManager {
    private var db: Database? = null
    private var connection: Connection? = null

    suspend fun init(context: Context) {
        val url   = SecurePrefs.getTursoUrl(context)   ?: error("Turso URL not set")
        val token = SecurePrefs.getTursoToken(context) ?: error("Turso token not set")
        val dbFile = File(context.filesDir, "nityaseva-replica.db").absolutePath

        db = Database.openRemoteReplica(dbFile, url, token)
        connection = db!!.connect()
        runMigrations()
    }

    // Sync — call on login if internet available
    suspend fun sync() {
        db?.sync()
        // Update last_synced in org_settings
        val now = System.currentTimeMillis().toString()
        connection?.execute(
            "INSERT INTO org_settings (key, value) VALUES ('last_synced_android', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            arrayOf(now)
        )
    }

    fun getConnection(): Connection =
        connection ?: error("Database not initialized")

    fun isInitialized(): Boolean = connection != null

    // Check internet connectivity before syncing
    fun isOnline(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private suspend fun runMigrations() {
        connection?.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL, mobile TEXT,
                passcode TEXT NOT NULL,
                role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
                last_login TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS org_settings (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS membership_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0, interval TEXT,
                is_active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS donation_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS members (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
                mobile TEXT, address TEXT, district TEXT, pin_code TEXT,
                membership_type INTEGER REFERENCES membership_types(id),
                status TEXT NOT NULL DEFAULT 'active',
                skip_until TEXT, last_donation TEXT,
                joined_at TEXT NOT NULL DEFAULT (datetime('now')),
                notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS donations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL REFERENCES members(id),
                donation_type INTEGER REFERENCES donation_types(id),
                amount REAL NOT NULL, paid_for TEXT,
                collected_by INTEGER REFERENCES users(id),
                slip_no TEXT, note TEXT,
                donated_at TEXT NOT NULL DEFAULT (datetime('now')),
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_members_name   ON members(name);
            CREATE INDEX IF NOT EXISTS idx_members_mobile ON members(mobile);
            CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(donated_at);
        """, emptyArray())
    }
}
```

---

## 6. Crypto Utility (`util/crypto/CryptoUtil.kt`)

```kotlin
object CryptoUtil {
    // bcrypt for passcode verification (same hashes as desktop)
    fun verifyPasscode(plain: String, hash: String): Boolean =
        BCrypt.verifyer().verify(plain.toCharArray(), hash).verified

    fun isBcryptHash(value: String): Boolean =
        value.startsWith("\$2b\$") || value.startsWith("\$2a\$")

    // AES-GCM decrypt — matches desktop Rust implementation
    // Key derived from app files dir path + pepper using SHA-256
    fun decrypt(encoded: String, appDataPath: String): String? {
        return try {
            val pepper  = "nityaseva-v1-credential-key-pepper"
            val keyBytes = sha256((appDataPath + pepper).toByteArray())

            val combined = Base64.decode(encoded, Base64.DEFAULT)
            if (combined.size < 12) return null

            val nonce      = combined.sliceArray(0 until 12)
            val ciphertext = combined.sliceArray(12 until combined.size)

            val keySpec = SecretKeySpec(keyBytes, "AES")
            val cipher  = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, keySpec, GCMParameterSpec(128, nonce))

            String(cipher.doFinal(ciphertext))
        } catch (e: Exception) {
            null
        }
    }

    fun encrypt(plaintext: String, appDataPath: String): String {
        val pepper   = "nityaseva-v1-credential-key-pepper"
        val keyBytes = sha256((appDataPath + pepper).toByteArray())

        val nonce   = ByteArray(12).also { SecureRandom().nextBytes(it) }
        val keySpec = SecretKeySpec(keyBytes, "AES")
        val cipher  = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, GCMParameterSpec(128, nonce))

        val ciphertext = cipher.doFinal(plaintext.toByteArray())
        val combined   = nonce + ciphertext
        return Base64.encodeToString(combined, Base64.DEFAULT)
    }

    private fun sha256(input: ByteArray): ByteArray =
        MessageDigest.getInstance("SHA-256").digest(input)

    fun isEncrypted(value: String): Boolean =
        try { Base64.decode(value, Base64.DEFAULT).size >= 12 } catch (e: Exception) { false }
}
```

---

## 7. Splash Screen with Triple-tap Config

### `ui/splash/SplashScreen.kt`

```kotlin
@Composable
fun SplashScreen(
    onConfigured: () -> Unit,
    onSkip: () -> Unit
) {
    val context = LocalContext.current
    var tapCount by remember { mutableStateOf(0) }
    var lastTapTime by remember { mutableStateOf(0L) }
    var showConfig by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        // Auto-proceed after 2 seconds if already configured
        delay(2000)
        if (!showConfig) {
            if (SecurePrefs.isConfigured(context)) onConfigured()
            // else stay — user needs to triple-tap
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F4F1))
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() }
            ) {
                val now = System.currentTimeMillis()
                if (now - lastTapTime > 1000) tapCount = 0
                tapCount++
                lastTapTime = now
                if (tapCount >= 3) {
                    showConfig = true
                    tapCount = 0
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            // Replace with your actual logo
            Image(
                painter = painterResource(id = R.drawable.logo),
                contentDescription = "Nityaseva",
                modifier = Modifier.size(100.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "Nityaseva",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF18160F)
            )
            Text(
                "Membership Management",
                fontSize = 13.sp,
                color = Color(0xFF7A756C),
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        // Subtle hint at bottom
        if (!SecurePrefs.isConfigured(context)) {
            Text(
                "Tap logo 3 times to configure",
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 32.dp),
                fontSize = 11.sp,
                color = Color(0xFF7A756C)
            )
        }
    }

    if (showConfig) {
        TursoConfigSheet(
            onSaved = {
                showConfig = false
                onConfigured()
            },
            onDismiss = { showConfig = false }
        )
    }
}

@Composable
fun TursoConfigSheet(onSaved: () -> Unit, onDismiss: () -> Unit) {
    val context = LocalContext.current
    var url by remember { mutableStateOf("") }
    var token by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Configure Database") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Enter your Turso credentials from app.turso.io",
                    fontSize = 13.sp, color = Color(0xFF7A756C))
                OutlinedTextField(
                    value = url, onValueChange = { url = it },
                    label = { Text("Database URL") },
                    placeholder = { Text("libsql://your-db.turso.io") },
                    singleLine = true, modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = token, onValueChange = { token = it },
                    label = { Text("Auth Token") },
                    placeholder = { Text("eyJhbGciOi...") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth()
                )
                if (error.isNotEmpty()) {
                    Text(error, color = Color(0xFFB91C1C), fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (url.isBlank() || token.isBlank()) { error = "Both fields required"; return@Button }
                    loading = true
                    scope.launch {
                        try {
                            SecurePrefs.saveTursoConfig(context, url.trim(), token.trim())
                            DatabaseManager.init(context)
                            if (DatabaseManager.isOnline(context)) DatabaseManager.sync()
                            onSaved()
                        } catch (e: Exception) {
                            error = "Connection failed: ${e.message}"
                            SecurePrefs.clear(context)
                        } finally { loading = false }
                    }
                },
                enabled = !loading,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDE5D04))
            ) { Text(if (loading) "Connecting…" else "Save & Connect") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
```

---

## 8. Login Screen (`ui/auth/LoginScreen.kt`)

Mobile login: enter mobile number first, then 6-digit PIN.

```kotlin
@Composable
fun LoginScreen(onLogin: (User) -> Unit) {
    var step by remember { mutableStateOf("mobile") } // "mobile" or "pin"
    var mobile by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFFF5F4F1)).padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Logo
        Image(painterResource(R.drawable.logo), "Nityaseva",
            modifier = Modifier.size(72.dp))
        Spacer(Modifier.height(12.dp))
        Text("Nityaseva", fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text("Membership Management", fontSize = 12.sp, color = Color(0xFF7A756C))
        Spacer(Modifier.height(40.dp))

        if (step == "mobile") {
            // Step 1: Mobile number
            Text("Enter your mobile number", fontSize = 15.sp, color = Color(0xFF4A4640))
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = mobile,
                onValueChange = { mobile = it },
                label = { Text("Mobile Number") },
                placeholder = { Text("01XXXXXXXXX") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = {
                    if (mobile.isBlank()) { error = "Enter mobile number"; return@Button }
                    step = "pin"
                    error = ""
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDE5D04))
            ) { Text("Continue") }
        } else {
            // Step 2: PIN pad
            Text("Enter your 6-digit PIN", fontSize = 15.sp, color = Color(0xFF4A4640))
            Text(mobile, fontSize = 13.sp, color = Color(0xFF7A756C))
            Spacer(Modifier.height(20.dp))

            // PIN dots
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                repeat(6) { i ->
                    Box(
                        modifier = Modifier.size(14.dp).clip(CircleShape).background(
                            if (i < pin.length) Color(0xFFDE5D04) else Color(0xFFD0CCC3)
                        )
                    )
                }
            }
            Spacer(Modifier.height(24.dp))

            // Number pad
            val keys = listOf("1","2","3","4","5","6","7","8","9","","0","⌫")
            LazyVerticalGrid(columns = GridCells.Fixed(3), modifier = Modifier.width(240.dp)) {
                items(keys) { key ->
                    if (key.isEmpty()) { Box(Modifier.padding(8.dp)) }
                    else {
                        TextButton(
                            onClick = {
                                when (key) {
                                    "⌫" -> if (pin.isNotEmpty()) pin = pin.dropLast(1)
                                    else -> if (pin.length < 6) {
                                        pin += key
                                        if (pin.length == 6) {
                                            loading = true
                                            scope.launch {
                                                try {
                                                    val user = verifyLogin(mobile, pin)
                                                    onLogin(user)
                                                } catch (e: Exception) {
                                                    error = e.message ?: "Invalid credentials"
                                                    pin = ""
                                                } finally { loading = false }
                                            }
                                        }
                                    }
                                }
                            },
                            modifier = Modifier.padding(4.dp)
                        ) {
                            Text(key, fontSize = 20.sp, fontWeight = FontWeight.Medium,
                                color = Color(0xFF18160F))
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))
            TextButton(onClick = { step = "mobile"; pin = ""; error = "" }) {
                Text("← Change number", color = Color(0xFF7A756C), fontSize = 13.sp)
            }
        }

        if (error.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text(error, color = Color(0xFFB91C1C), fontSize = 13.sp)
        }
    }
}

// Verify mobile + PIN against users table (bcrypt)
private suspend fun verifyLogin(mobile: String, pin: String): User {
    val conn = DatabaseManager.getConnection()
    val appDataPath = "" // set from context in real implementation

    val rows = conn.query(
        "SELECT id, name, mobile, role, status, passcode FROM users WHERE status = 'active'",
        emptyArray()
    )

    for (row in rows) {
        val storedMobile   = row.getString(2)   // encrypted mobile
        val storedPasscode = row.getString(5)

        // Decrypt and compare mobile
        val decryptedMobile = if (CryptoUtil.isEncrypted(storedMobile ?: ""))
            CryptoUtil.decrypt(storedMobile!!, appDataPath) else storedMobile

        if (decryptedMobile == mobile || storedMobile == mobile) {
            val passMatch = if (CryptoUtil.isBcryptHash(storedPasscode))
                CryptoUtil.verifyPasscode(pin, storedPasscode)
            else storedPasscode == pin

            if (passMatch) {
                val role = row.getString(3)?.let {
                    if (CryptoUtil.isEncrypted(it)) CryptoUtil.decrypt(it, appDataPath) else it
                } ?: "operator"

                return User(
                    id     = row.getLong(0),
                    name   = row.getString(1) ?: "",
                    mobile = mobile,
                    role   = role,
                    status = row.getString(4) ?: "active"
                )
            }
        }
    }
    throw Exception("Invalid mobile or PIN")
}
```

---

## 9. Navigation (`MainActivity.kt`)

```kotlin
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            NityasevaTheme {
                NityasevaNavHost()
            }
        }
    }
}

@Composable
fun NityasevaNavHost() {
    val context = LocalContext.current
    val navController = rememberNavController()
    var currentUser by remember { mutableStateOf<User?>(null) }

    NavHost(navController = navController, startDestination = "splash") {
        composable("splash") {
            SplashScreen(
                onConfigured = {
                    navController.navigate("login") {
                        popUpTo("splash") { inclusive = true }
                    }
                },
                onSkip = { /* stay on splash until configured */ }
            )
        }
        composable("login") {
            LoginScreen(onLogin = { user ->
                currentUser = user
                navController.navigate("main") {
                    popUpTo("login") { inclusive = true }
                }
            })
        }
        composable("main") {
            currentUser?.let { user ->
                MainShell(user = user, onLogout = {
                    currentUser = null
                    navController.navigate("login") {
                        popUpTo("main") { inclusive = true }
                    }
                })
            }
        }
    }
}
```

---

## 10. Main Shell with Bottom Navigation (`ui/shared/MainShell.kt`)

```kotlin
sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    object Dashboard : Screen("dashboard", "Dashboard", Icons.Default.Home)
    object Members   : Screen("members",   "Members",   Icons.Default.People)
    object Donations : Screen("donations", "Donations", Icons.Default.AttachMoney)
    object Contacts  : Screen("contacts",  "Contacts",  Icons.Default.Contacts)
    object Settings  : Screen("settings",  "Settings",  Icons.Default.Settings)
}

@Composable
fun MainShell(user: User, onLogout: () -> Unit) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var lastSynced by remember { mutableStateOf("") }

    // Load last synced from DB
    LaunchedEffect(Unit) {
        try {
            val conn = DatabaseManager.getConnection()
            val rows = conn.query(
                "SELECT value FROM org_settings WHERE key = 'last_synced_android'",
                emptyArray()
            )
            lastSynced = rows.firstOrNull()?.getString(0) ?: "Never"
        } catch (e: Exception) { lastSynced = "Unknown" }
    }

    val screens = listOf(
        Screen.Dashboard, Screen.Members,
        Screen.Donations, Screen.Contacts, Screen.Settings
    )

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route

                screens.forEach { screen ->
                    NavigationBarItem(
                        selected = currentRoute == screen.route,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(screen.icon, screen.label) },
                        label = { Text(screen.label, fontSize = 11.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor   = Color(0xFFDE5D04),
                            selectedTextColor   = Color(0xFFDE5D04),
                            indicatorColor      = Color(0xFFFFF8ED),
                            unselectedIconColor = Color(0xFF7A756C),
                            unselectedTextColor = Color(0xFF7A756C),
                        )
                    )
                }
            }
        }
    ) { padding ->
        NavHost(navController, startDestination = "dashboard",
            modifier = Modifier.padding(padding)) {
            composable("dashboard")  { DashboardScreen(user) }
            composable("members")    { MembersScreen(user) }
            composable("donations")  { DonationsScreen(user) }
            composable("contacts")   { ContactsScreen() }
            composable("settings")   { SettingsScreen(user, lastSynced, onLogout) }
        }
    }
}
```

---

## 11. Contacts Screen — Phonebook Style (`ui/contacts/ContactsScreen.kt`)

```kotlin
@Composable
fun ContactsScreen() {
    val context = LocalContext.current
    var search by remember { mutableStateOf("") }
    var members by remember { mutableStateOf<List<Member>>(emptyList()) }

    LaunchedEffect(search) {
        delay(250)
        members = loadMembers(search)
    }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF5F4F1))) {
        // Search bar
        OutlinedTextField(
            value = search, onValueChange = { search = it },
            placeholder = { Text("Search name or mobile…") },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            singleLine = true,
            shape = RoundedCornerShape(12.dp)
        )

        LazyColumn {
            items(members) { member ->
                MemberContactCard(member)
            }
        }
    }
}

@Composable
fun MemberContactCard(member: Member) {
    val context = LocalContext.current
    var showActions by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable { showActions = true },
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar circle
            Box(
                modifier = Modifier.size(44.dp).clip(CircleShape)
                    .background(Color(0xFFFFF8ED)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    member.name.first().uppercase(),
                    fontSize = 18.sp, fontWeight = FontWeight.Bold,
                    color = Color(0xFFDE5D04)
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(member.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                member.mobile?.let {
                    Text(it, fontSize = 13.sp, color = Color(0xFF7A756C))
                }
                member.district?.let {
                    Text(it, fontSize = 12.sp, color = Color(0xFF7A756C))
                }
            }
            // Status badge
            Surface(
                shape = RoundedCornerShape(99.dp),
                color = if (member.status == "active") Color(0xFFD4EDDA) else Color(0xFFE4E1DA)
            ) {
                Text(
                    member.status,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    fontSize = 11.sp, fontWeight = FontWeight.Bold,
                    color = if (member.status == "active") Color(0xFF145A1A) else Color(0xFF4A4640)
                )
            }
        }
    }

    // Action bottom sheet on click
    if (showActions && member.mobile != null) {
        ContactActionsSheet(
            member = member,
            onDismiss = { showActions = false }
        )
    }
}

@Composable
fun ContactActionsSheet(member: Member, onDismiss: () -> Unit) {
    val context = LocalContext.current

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(member.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(member.mobile ?: "", fontSize = 13.sp, color = Color(0xFF7A756C))
            Spacer(Modifier.height(20.dp))

            // Native Phone Call
            ListItem(
                headlineContent = { Text("Call") },
                leadingContent = { Icon(Icons.Default.Call, null, tint = Color(0xFF1E6B22)) },
                modifier = Modifier.clickable {
                    val intent = Intent(Intent.ACTION_DIAL,
                        Uri.parse("tel:${member.mobile}"))
                    context.startActivity(intent)
                    onDismiss()
                }
            )
            Divider()
            // Native SMS
            ListItem(
                headlineContent = { Text("Send SMS") },
                leadingContent = { Icon(Icons.Default.Sms, null, tint = Color(0xFF1251A3)) },
                modifier = Modifier.clickable {
                    val intent = Intent(Intent.ACTION_SENDTO,
                        Uri.parse("smsto:${member.mobile}"))
                    context.startActivity(intent)
                    onDismiss()
                }
            )
            Divider()
            // WhatsApp
            ListItem(
                headlineContent = { Text("WhatsApp") },
                leadingContent = {
                    Icon(Icons.Default.Chat, null, tint = Color(0xFF25D366))
                },
                modifier = Modifier.clickable {
                    var num = member.mobile!!.replace(Regex("[^0-9]"), "")
                    if (num.startsWith("0")) num = "880${num.substring(1)}"
                    val intent = Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://wa.me/$num"))
                    context.startActivity(intent)
                    onDismiss()
                }
            )
            Spacer(Modifier.height(16.dp))
        }
    }
}
```

---

## 12. Receipt PNG Generation (`util/receipt/ReceiptGenerator.kt`)

```kotlin
object ReceiptGenerator {

    fun generate(donation: Donation, member: Member, orgName: String): Bitmap {
        val width  = 800
        val height = 500
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val bgPaint = Paint().apply { color = Color.parseColor("#FFFFFF") }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

        // Orange header bar
        val headerPaint = Paint().apply { color = Color.parseColor("#DE5D04") }
        canvas.drawRect(0f, 0f, width.toFloat(), 80f, headerPaint)

        // Org name in header
        val orgPaint = Paint().apply {
            color = Color.WHITE; textSize = 28f
            typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        canvas.drawText(orgName, 24f, 52f, orgPaint)

        // Receipt title
        val titlePaint = Paint().apply {
            color = Color.parseColor("#18160F"); textSize = 20f
            typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        canvas.drawText("DONATION RECEIPT", 24f, 120f, titlePaint)

        val labelPaint = Paint().apply {
            color = Color.parseColor("#7A756C"); textSize = 16f; isAntiAlias = true
        }
        val valuePaint = Paint().apply {
            color = Color.parseColor("#18160F"); textSize = 16f; isAntiAlias = true
        }

        // Fields
        val rows = listOf(
            "Slip No"   to (donation.slipNo ?: "—"),
            "Member"    to member.name,
            "Mobile"    to (member.mobile ?: "—"),
            "Type"      to (donation.typeName ?: "General"),
            "Paid For"  to (donation.paidFor ?: "—"),
            "Date"      to donation.donatedAt.take(10),
        )

        rows.forEachIndexed { i, (label, value) ->
            val y = 160f + (i * 36f)
            canvas.drawText("$label:", 24f, y, labelPaint)
            canvas.drawText(value, 200f, y, valuePaint)
        }

        // Amount box
        val amountBoxPaint = Paint().apply { color = Color.parseColor("#FFF8ED") }
        canvas.drawRoundRect(24f, 390f, 540f, 450f, 12f, 12f, amountBoxPaint)
        val amountLabelPaint = Paint().apply {
            color = Color.parseColor("#7A756C"); textSize = 14f; isAntiAlias = true
        }
        canvas.drawText("Total Amount", 36f, 428f, amountLabelPaint)
        val amountPaint = Paint().apply {
            color = Color.parseColor("#DE5D04"); textSize = 26f
            typeface = Typeface.DEFAULT_BOLD; isAntiAlias = true
        }
        canvas.drawText("৳ ${donation.amount}", 300f, 432f, amountPaint)

        // Footer
        val footerPaint = Paint().apply {
            color = Color.parseColor("#9B9589"); textSize = 12f; isAntiAlias = true
        }
        canvas.drawText("Nityaseva — Membership Management", 24f, 482f, footerPaint)

        return bitmap
    }

    fun share(context: Context, bitmap: Bitmap, slipNo: String?) {
        val file = File(context.cacheDir, "receipt-${slipNo ?: "receipt"}.png")
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }

        val uri = FileProvider.getUriForFile(context,
            "${context.packageName}.provider", file)

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share Receipt"))
    }
}
```

Add to `AndroidManifest.xml`:
```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.provider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths"/>
</provider>
```

Create `res/xml/file_paths.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<paths>
    <cache-path name="cache" path="."/>
</paths>
```

---

## 13. Settings Screen (`ui/settings/SettingsScreen.kt`)

```kotlin
@Composable
fun SettingsScreen(user: User, lastSynced: String, onLogout: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var syncing by remember { mutableStateOf(false) }
    var syncMessage by remember { mutableStateOf("") }
    var currentLastSynced by remember { mutableStateOf(lastSynced) }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF5F4F1)).padding(16.dp)) {
        Text("Settings", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(20.dp))

        // Sync card
        Card(colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Turso Sync", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                Spacer(Modifier.height(8.dp))
                Text("Last synced: $currentLastSynced",
                    fontSize = 13.sp, color = Color(0xFF7A756C))
                if (syncMessage.isNotEmpty()) {
                    Text(syncMessage, fontSize = 13.sp,
                        color = if (syncing) Color(0xFF7A756C) else Color(0xFF1E6B22))
                }
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        if (!DatabaseManager.isOnline(context)) {
                            syncMessage = "No internet connection"
                            return@Button
                        }
                        syncing = true
                        syncMessage = "Syncing…"
                        scope.launch {
                            try {
                                DatabaseManager.sync()
                                currentLastSynced = "Just now"
                                syncMessage = "Synced successfully"
                            } catch (e: Exception) {
                                syncMessage = "Sync failed: ${e.message}"
                            } finally { syncing = false }
                        }
                    },
                    enabled = !syncing,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDE5D04))
                ) { Text(if (syncing) "Syncing…" else "↻ Sync Now") }
            }
        }

        Spacer(Modifier.height(12.dp))

        // User info card
        Card(colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(user.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                Text(user.mobile, fontSize = 13.sp, color = Color(0xFF7A756C))
                Text(user.role.replace("_", " "),
                    fontSize = 12.sp, color = Color(0xFFDE5D04))
            }
        }

        Spacer(Modifier.height(12.dp))

        // Logout
        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, Color(0xFFB91C1C)),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFB91C1C))
        ) { Text("Log Out") }
    }
}
```

---

## 14. Permissions (`AndroidManifest.xml`)

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="android.permission.CALL_PHONE"/>
```

---

## 15. Build & APK Distribution

### Debug APK (for testing)
```bash
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (for distribution)
```bash
# Generate keystore (one time only)
keytool -genkey -v -keystore nityaseva.keystore \
  -alias nityaseva -keyalg RSA -keysize 2048 -validity 10000

# Add to app/build.gradle.kts
signingConfigs {
    create("release") {
        storeFile = file("nityaseva.keystore")
        storePassword = "your_password"
        keyAlias = "nityaseva"
        keyPassword = "your_password"
    }
}

# Build
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

### Install on device
```bash
adb install app-release.apk

# Or share the APK file directly via WhatsApp/Google Drive
# User enables: Settings → Security → Install unknown apps
```

---

## 16. Key Implementation Notes

**Encryption compatibility with desktop:**
The `CryptoUtil.decrypt()` on Android uses identical logic to the Rust `crypto.rs` — same SHA-256 key derivation, same AES-256-GCM, same nonce prepending. However the `app_data_path` used as the key seed will differ between desktop and Android. This means:

- Desktop encrypts `turso_url` and `turso_token` with the Mac/Windows app data path as seed
- Android encrypts nothing in the DB — credentials are in `EncryptedSharedPreferences` only
- `users.passcode` bcrypt hashes are platform-agnostic — desktop-created hashes verify fine on Android
- `users.role` and `users.mobile` are AES-encrypted with the desktop's path — Android must **decrypt with the desktop path** or read the raw value

**Simplest solution:** On Android, for `users.role` and `users.mobile`, try to decrypt — if it fails, use the raw value. This means you need to know the desktop's app data path, which varies. Better: **add a plaintext role copy** to `org_settings` keyed by user ID at login time from desktop, OR have Android use a fixed known key rather than the device path.

**I recommend:** When writing the `AuthRepository` on Android, try AES decrypt with a fixed Android-specific key. On desktop, also store a separate `users.role_plain` column that Android can read directly. This avoids the cross-platform key mismatch entirely.

**libSQL Android maturity note:**
The `libsql-android` SDK works but has less Kotlin documentation than the Rust version. Expect to read the Java interop API. The core `Database.openRemoteReplica()` and `Connection.query()` / `Connection.execute()` methods are stable.

**Offline writes:**
All writes go to the local replica file immediately. They are pushed to Turso cloud on the next `db.sync()` call. No special handling needed — this is built into libSQL embedded replica mode.
