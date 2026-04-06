// --- DICTIONARY & CONFIG ---
const langData = {
    en: { login: "Member Login", loginBtn: "SIGN IN", newAcc: "Create Account", income: "Income", expense: "Expense", balance: "Balance", navHome: "Home", navCat: "Categories", navSet: "Settings", navProf: "Profile", save: "Save", incTitle: "INCOME SOURCES", smsTitle: "SMS Parser", detectBtn: "Analyze SMS", transHeader: "EXPENSE LOG", saveCat: "Create Category", editProf: "Edit Profile", yourCats: "My Budgets", fullName: "Name", ageLabel: "Age", dobLabel: "Birthday", addrLabel: "Address", moveHeader: "Edit Entry", forgot: "Forgot Password?", months: ["January","February","March","April","May","June","July","August","September","October","November","December"] },
    ta: { login: "உள்நுழை", loginBtn: "நுழை", newAcc: "கணக்கை உருவாக்கு", income: "வருமானம்", expense: "செலவு", balance: "மீதி", navHome: "முகப்பு", navCat: "வகைகள்", navSet: "அமைப்புகள்", navProf: "சுயவிவரம்", save: "சேமி", incTitle: "வருமானம்", smsTitle: "SMS நகல்", detectBtn: "SMS சேர்", transHeader: "பரிவர்த்தனைகள்", saveCat: "உருவாக்கு", editProf: "மாற்று", yourCats: "என் பட்ஜெட்", fullName: "பெயர்", months: ["ஜனவரி","பிப்ரவரி","மார்ச்","ஏப்ரல்","மே","ஜூன்","ஜூலை","ஆகஸ்ட்","செப்டம்பர்","அக்டோபர்","நவம்பர்","டிசம்பர்"] }
};

const curSymbols = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

// --- APP STATE ---
let app = JSON.parse(localStorage.getItem("EXP_PRO_V5")) || { users: {}, active: null, data: {} };
let cMonth = new Date().getMonth(), cYear = new Date().getFullYear();
let myChart = null;
let currentTransId = null;
let pendingSMS = null;

// --- AUTHENTICATION ---
function toggleAuth(mode) {
    document.getElementById('login-form').classList.toggle('hidden', mode === 'reg');
    document.getElementById('reg-form').classList.toggle('hidden', mode === 'login');
}

function registerUser() {
    const u = document.getElementById('reg-user').value.trim();
    const p = document.getElementById('reg-pass').value.trim();
    const d = document.getElementById('reg-dob').value; // Get the DOB

    if(!u || !p || !d) return alert("Please fill all fields including Date of Birth!");
    
    // Save the user and include the DOB in the details object
    app.users[u] = { 
        pass: p, 
        name: u, 
        lang: 'en', 
        cur: 'INR', 
        pic: '', 
        details: { dob: d } 
    };
    
    app.data[u] = {};
    save(); 
    alert("Registration Successful!");
    toggleAuth('login');
}

function loginUser() {
    const u = document.getElementById('log-user').value.trim();
    const p = document.getElementById('log-pass').value.trim();
    if(app.users[u] && app.users[u].pass === p) {
        app.active = u;
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        init();
    } else alert("Access Denied");
}

function logout() { app.active = null; save(); location.reload(); }

function changePassword() {
    const u = app.users[app.active];
    if(document.getElementById('old-pass').value === u.pass) {
        u.pass = document.getElementById('new-pass').value;
        document.getElementById('old-pass').value = "";
        document.getElementById('new-pass').value = "";
        save(); alert("Password Secured");
    }
}

function showResetForm() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('reg-form').classList.add('hidden');
    document.getElementById('reset-form').classList.remove('hidden');
}

function hideResetForm() {
    document.getElementById('reset-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
}

function performReset() {
    const uName = document.getElementById('reset-user').value.trim();
    const dobInput = document.getElementById('reset-dob').value;
    const newPass = document.getElementById('reset-new-pass').value.trim();

    if (!app.users[uName]) {
        return alert("User not found!");
    }

    const userRecord = app.users[uName];

    // Check if the user has a DOB saved in their profile
    if (userRecord.details && userRecord.details.dob === dobInput) {
        if (!newPass) return alert("Please enter a new password");
        
        app.users[uName].pass = newPass;
        save(); 
        
        alert("Password updated successfully! Logging you in...");
        
        // Auto-login logic
        app.active = uName;
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        init();
    } else {
        alert("Verification failed. Incorrect Date of Birth.");
    }
}

// --- DATABASE HANDLERS ---
function getDB() {
    const k = `${cYear}-${cMonth + 1}`;
    
    // If this month doesn't exist in our app data yet
    if (!app.data[app.active][k]) {
        
        // 1. Figure out what the PREVIOUS month's key would be
        let prevMonth = cMonth; // If current is May (4), prev is April (3)
        let prevYear = cYear;
        
        if (prevMonth === 0) { // If current is Jan, prev is Dec of last year
            prevMonth = 12;
            prevYear--;
        }
        
        const prevKey = `${prevYear}-${prevMonth}`;
        let existingCats = [];

        // 2. Check if that specific previous month has categories
        if (app.data[app.active][prevKey] && app.data[app.active][prevKey].cats) {
            existingCats = app.data[app.active][prevKey].cats;
        } else {
            // 3. Fallback: If the immediate previous month isn't found, 
            // just grab the most recent month that DOES have categories
            const allKeys = Object.keys(app.data[app.active]);
            if (allKeys.length > 0) {
                const latestKey = allKeys.sort().reverse()[0];
                existingCats = app.data[app.active][latestKey].cats || [];
            }
        }

        // 4. Initialize the new month with those categories (Deep Copy)
        app.data[app.active][k] = { 
            trans: [], 
            cats: JSON.parse(JSON.stringify(existingCats)) 
        };
    }
    
    return app.data[app.active][k];
}

function init() {
    const u = app.users[app.active];
    document.getElementById('header-username').innerText = u.name;
    // Populate dropdowns
    document.getElementById('s-lang').innerHTML = Object.keys(langData).map(l=>`<option value="${l}">${l.toUpperCase()}</option>`).join('');
    document.getElementById('s-cur').innerHTML = Object.keys(curSymbols).map(c=>`<option value="${c}">${c}</option>`).join('');
    document.getElementById('s-lang').value = u.lang;
    document.getElementById('s-cur').value = u.cur;
    
    // Profile Fields (Hidden logic preserved)
    document.getElementById('p-name').value = u.name;
    document.getElementById('p-age').value = u.details?.age || "";
    document.getElementById('p-dob').value = u.details?.dob || "";
    document.getElementById('p-addr').value = u.details?.addr || "";
    document.getElementById('p-img').src = u.pic || 'https://via.placeholder.com/120';
    refresh();
    // Add this inside function init() { ... }
document.getElementById('display-name-heading').innerText = app.users[app.active].name;
}

// --- CORE REFRESH (Logic Integration) ---
function refresh() {
    const db = getDB();
    const u = app.users[app.active];
    const sym = curSymbols[u.cur];
    const lang = langData[u.lang] || langData.en;

    // Multi-Language Translation
    document.querySelectorAll('[data-t]').forEach(el => {
        const k = el.getAttribute('data-t');
        if(lang[k]) el.innerText = lang[k];
    });

    document.getElementById('month-display').innerText = `${lang.months[cMonth]} ${cYear}`;

    const incTotal = db.trans.filter(t => t.type === 'income').reduce((s, x) => s + x.amt, 0);
    const expTotal = db.trans.filter(t => t.type === 'expense').reduce((s, x) => s + x.amt, 0);

    document.getElementById('sum-inc').innerText = sym + incTotal;
    document.getElementById('sum-exp').innerText = sym + expTotal;
    document.getElementById('sum-bal').innerText = sym + (incTotal - expTotal);

    renderTransactions(db, sym);
    renderCategories(db, sym);
    updateChart(db);
}

function renderTransactions(db, sym) {
    const iList = document.getElementById('income-list');
    const eList = document.getElementById('transaction-list');
    
    // 1. Define the month we are looking at (e.g., "2026-04")
    const currentMonthKey = `${cYear}-${(cMonth + 1).toString().padStart(2, '0')}`;

    // 2. Filter ONLY the transactions that start with that Year-Month
    const filteredTrans = db.trans.filter(t => t.date.startsWith(currentMonthKey));

    // 3. Render Income (NOW WITH DELETE ICON)
    iList.innerHTML = filteredTrans.filter(t => t.type === 'income').map(t => `
        <div class="trans-item">
            <div class="t-details">
                <b>${t.note}</b>
                <small>${t.date}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="color:var(--green); font-weight:bold">${sym}${t.amt}</div>
                <i class="fas fa-trash" 
                   style="color:#ccc; cursor:pointer; font-size: 0.9rem;" 
                   onclick="deleteSpecificTransaction(${t.id})">
                </i>
            </div>
        </div>`).join('');

    // 4. Render Expenses (Keeping your existing logic)
    eList.innerHTML = filteredTrans.filter(t => t.type === 'expense').map(t => `
        <div class="trans-item" ondblclick="openEditModal(${t.id})">
            <div class="t-details">
                <b>${t.note}</b>
                <small>${t.cat} | ${t.date}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="color:var(--red); font-weight:bold">${sym}${t.amt}</div>
                <i class="fas fa-trash" 
                   style="color:#ccc; cursor:pointer; font-size: 0.9rem;" 
                   onclick="deleteSpecificTransaction(${t.id})">
                </i>
            </div>
        </div>`).join('');
}

function renderCategories(db, sym) {
    const container = document.getElementById('cat-list-display');
    // Identify the current month/year view
    const currentMonthKey = `${cYear}-${(cMonth + 1).toString().padStart(2, '0')}`;

    container.innerHTML = db.cats.map(c => {
    const spent = db.trans
        .filter(t => t.cat === c.name && t.type === 'expense' && t.date.startsWith(currentMonthKey))
        .reduce((s, x) => s + x.amt, 0);
        
    const rem = c.limit - spent;
    const progress = Math.min((spent / c.limit) * 100, 100);
    
    // Use the saved alert % or default to 80 if not found
    const alertThreshold = c.alert || 80;

    return `
        <div class="cat-card">
            <div class="cat-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <b>${c.name}</b>
                    <span style="font-size:0.7rem; color:var(--purp); margin-left:5px;">(${alertThreshold}%)</span>
                </div>
                <i class="fas fa-trash" style="color:#ccc; cursor:pointer" onclick="deleteCategory('${c.name}')"></i>
            </div>
            <div style="font-size:0.8rem">Limit: ${sym}${c.limit} | Spent: ${sym}${spent}</div>
            <div class="cat-progress">
                <div class="cat-fill" style="width:${progress}%; background:${progress > alertThreshold ? 'var(--red)' : 'var(--purp)'}"></div>
            </div>
            <div class="rem-text">Remaining: ${sym}${rem}</div>
        </div>`;
}).join('');
}

// --- TRANSACTION LOGIC ---
function addEntry(type) {
    const amt = parseFloat(document.getElementById(type === 'income' ? 'i-amt' : 'e-amt').value);
    const date = document.getElementById(type === 'income' ? 'i-date' : 'e-date').value;
    const note = document.getElementById(type === 'income' ? 'i-note' : 'e-note').value;
    const cat = type === 'expense' ? document.getElementById('e-cat').value : 'Cash';

    if(!amt || !date || !note) return alert("Fill all fields");

    const db = getDB();
    db.trans.push({ id: Date.now(), type, amt, date, note, cat });
    
    // Alert Check
    if(type === 'expense') checkAlert(cat, db);

    // Clear Inputs
    document.querySelectorAll('.modal input').forEach(i => i.value = "");
    save(); refresh(); closeModal(type + '-modal');
}

// --- TRANSACTION LOGIC ---

function deleteSpecificTransaction(id) {
    if(confirm("Are you sure you want to delete this transaction?")) {
        const db = getDB();
        
        // 1. Filter out the transaction with the matching ID
        db.trans = db.trans.filter(t => t.id !== id);
        
        // 2. Save the updated data to localStorage
        save(); 
        
        // 3. Refresh the UI (Totals, List, and Pie Chart)
        refresh(); 
    }
}

// ... rest of your existing functions like addEntry ...

function checkAlert(catName, db) {
    const cat = db.cats.find(c => c.name === catName);
    if (!cat) return;

    // 1. Only look at the current month/year
    const currentMonthKey = `${cYear}-${(cMonth + 1).toString().padStart(2, '0')}`;
    
    const spent = db.trans
        .filter(t => t.cat === catName && t.type === 'expense' && t.date.startsWith(currentMonthKey))
        .reduce((s, x) => s + x.amt, 0);

    // 2. Use the custom alert or 80 as a backup
    const threshold = cat.alert || 80;
    const perc = (spent / cat.limit) * 100;

    // 3. Trigger the alert if you cross your custom threshold
    if (perc >= threshold) {
        alert(`⚠️ BUDGET ALERT: ${catName} is at ${perc.toFixed(1)}% of your monthly limit!`);
    }
}

// --- SMS LOGIC ---
function processSMS() {
    const raw = document.getElementById('sms-input').value.toLowerCase();
    if (!raw) return alert("Please paste an SMS first");

    // 1. SMART AMOUNT EXTRACTION
    let amt = 0;
    const smartAmtMatch = raw.match(/(?:rs\.?|inr|amounting to|sum of)\s*([\d,.]+)/);
    
    if (smartAmtMatch) {
        amt = parseFloat(smartAmtMatch[1].replace(/,/g, ''));
    } else {
        const allNums = raw.match(/\d+(\.\d+)?/g);
        if (!allNums) return alert("Could not find an amount.");
        // Use Math.max to ignore short account numbers like '1234'
        amt = Math.max(...allNums.map(Number)); 
    }

    // 2. Identify Direction
    const incomeKeywords = ['credited', 'received', 'added', 'salary', 'deposited', 'cashback'];
    const isIncome = incomeKeywords.some(word => raw.includes(word));

    // 3. SMART NOTE EXTRACTION (Updated for "at" and "to")
    let smartNote = "SMS: " + raw.substring(0, 30);
    
    if (isIncome && raw.includes("by ")) {
        // Income: "credited by Amazon" -> From: Amazon
        smartNote = "From: " + raw.split("by ").pop().split(" on ")[0].trim();
    } else if (!isIncome && raw.includes("at ")) {
        // Expense: "debited at ZOMATO" -> At: Zomato
        smartNote = "At: " + raw.split("at ").pop().split(" on ")[0].trim();
    } else if (!isIncome && raw.includes("to ")) {
        // Expense: "paid to Swiggy" -> To: Swiggy
        smartNote = "To: " + raw.split("to ").pop().split(" on ")[0].trim();
    }

    pendingSMS = { 
        amt, 
        date: new Date().toISOString().split('T')[0], 
        note: smartNote 
    };
    
    const db = getDB();

    if (isIncome) {
        finalizeIncomeSMS(); 
    } else {
        // --- LOGIC FOR EXPENSE ---
        const foundCat = db.cats.find(c => raw.includes(c.name.toLowerCase()));
        if (foundCat) {
            db.trans.push({
                id: Date.now(), 
                type: 'expense', 
                amt: amt,
                date: pendingSMS.date, 
                note: pendingSMS.note, 
                cat: foundCat.name
            });
            save(); refresh();
            document.getElementById('sms-input').value = "";
            checkAlert(foundCat.name, db);
        } else {
            document.getElementById('m-name').value = ""; 
            openModal('missing-cat-modal');
        }
    }
}

function finalizeIncomeSMS() {
    const db = getDB();
    const u = app.users[app.active];
    
    db.trans.push({
        id: Date.now(),
        type: 'income',
        amt: pendingSMS.amt, // <--- Make sure this matches the pendingSMS object
        date: pendingSMS.date,
        note: pendingSMS.note,
        cat: 'Income'
    });

    save();
    refresh();
    
    document.getElementById('sms-input').value = "";
    alert(`Successfully added ${curSymbols[u.cur]}${pendingSMS.amt} as Income!`);
}

// Locate your finalizeSMSWithCat function and update it
function finalizeSMSWithCat() {
    // 1. Get the value from the dropdown
    let catName = document.getElementById('m-name').value;
    const db = getDB();

    // 2. Validate Selection
    // If it's empty or still says "NEW", the user hasn't successfully picked/typed a name
    if (!catName || catName === "NEW") {
        return alert("Please select a category or use '+ Add New Category' first.");
    }

    const catLimit = parseFloat(document.getElementById('m-limit').value) || 0;
    const catAlert = parseFloat(document.getElementById('m-alert').value) || 80;

    // 3. Check if it truly exists or needs to be created in the database
    let existingCat = db.cats.find(c => c.name.toLowerCase() === catName.toLowerCase());
    
    if (!existingCat) {
        // Create the new category in your saved categories list
        db.cats.push({ 
            name: catName, 
            limit: catLimit, 
            alert: catAlert 
        });
    }

    // 4. Add the transaction from the SMS
    if (pendingSMS) {
        // Use the exact name (matching case if it existed)
        const finalName = existingCat ? existingCat.name : catName;
        
        const newTrans = {
            id: Date.now(),
            type: 'expense',
            amt: pendingSMS.amt,
            note: pendingSMS.note,
            cat: finalName, 
            date: new Date().toISOString().split('T')[0]
        };
        
        db.trans.push(newTrans);
        
        // Trigger the budget alert check (your "only once" alert logic)
        checkAlert(finalName, db);
        
        pendingSMS = null;
    }

    // 5. Save and UI Refresh
    save();
    closeModal('missing-cat-modal');
    refresh(); 
}
// Ensure your checkBudgetAlert function (or similar) handles the logic
function checkBudgetAlert(catName, newAmount) {
    const db = getDB();
    const cat = db.cats.find(c => c.name.toLowerCase() === catName.toLowerCase());
    if (!cat || cat.limit === 0) return;

    const totalSpent = db.trans
        .filter(t => t.cat === catName && t.type === 'expense')
        .reduce((sum, t) => sum + t.amt, 0);

    const usedPct = (totalSpent / cat.limit) * 100;

    // Trigger alert if it reaches 100% or your specified alert %
    if (usedPct >= 100) {
        alert(`BUDGET ALERT: ${catName} is at ${usedPct.toFixed(1)}% of your monthly limit!`);
    } else if (usedPct >= cat.alert) {
        // Optional: Alert if it hits the 80% (or user defined) threshold
        alert(`Warning: ${catName} has reached ${usedPct.toFixed(1)}% of its limit.`);
    }
}
function saveNewCat() {
    const n = document.getElementById('c-name').value.trim();
    const l = parseFloat(document.getElementById('c-limit').value);
    
    // This '|| 80' ensures it doesn't break if the box is empty
    const a = parseFloat(document.getElementById('c-alert').value) || 80;

    if (!n || isNaN(l)) {
        alert("Please enter a Name and a valid Limit!");
        return;
    }

    const db = getDB();
    db.cats.push({ name: n, limit: l, alert: a });
    
    save(); 
    refresh();

    // Clear all three input fields
    document.getElementById('c-name').value = ""; 
    document.getElementById('c-limit').value = "";
    document.getElementById('c-alert').value = "";
}
// --- CATEGORY LOGIC ---


function deleteCategory(name) {
    if(confirm(`Delete category "${name}"?`)) {
        const db = getDB();
        db.cats = db.cats.filter(c => c.name !== name);
        save(); refresh();
    }
}

// --- MOVE TRANSACTION LOGIC ---
function openEditModal(id) {
    const db = getDB();
    const t = db.trans.find(x => x.id === id);
    currentTransId = id;
    document.getElementById('edit-info').innerText = `${t.note}: ${curSymbols[app.users[app.active].cur]}${t.amt}`;
    document.getElementById('move-cat-select').innerHTML = db.cats.map(c => `<option value="${c.name}" ${c.name === t.cat ? 'selected' : ''}>${c.name}</option>`).join('');
    openModal('edit-trans-modal');
}

function moveTransaction() {
    const db = getDB();
    const t = db.trans.find(x => x.id === currentTransId);
    const newCat = document.getElementById('move-cat-select').value;
    t.cat = newCat;
    save(); refresh(); closeModal('edit-trans-modal');
}

function deleteTransaction() {
    const db = getDB();
    db.trans = db.trans.filter(x => x.id !== currentTransId);
    save(); refresh(); closeModal('edit-trans-modal');
}

// --- UTILS ---
function save() { localStorage.setItem("EXP_PRO_V5", JSON.stringify(app)); }
function showPage(id) {
    document.querySelectorAll('.sub-page').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}
function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('hidden'); // Show the modal

    // Add this part to fill the dropdown
    if (id === 'missing-cat-modal') {
        const db = getDB();
        const select = document.getElementById('m-name');
        
        // Reset the dropdown so it doesn't double-up categories
        select.innerHTML = '<option value="">-- Select Existing --</option>';
        
        // Loop through your categories and add them as options
        db.cats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.innerText = cat.name;
            select.appendChild(opt);
        });

        // Add an option to create a new one if it's not in the list
        const newOpt = document.createElement('option');
        newOpt.value = "NEW";
        newOpt.innerText = "+ Add New Category";
        select.appendChild(newOpt);

        // --- NEW LOGIC STARTS HERE ---
        // This listener waits for you to click "Add New Category"
        select.onchange = function() {
            if (this.value === "NEW") {
                const newCatName = prompt("Enter the name for your new category:");
                
                if (newCatName && newCatName.trim() !== "") {
                    const trimmedName = newCatName.trim();
                    // Create a temporary option for the new name
                    const opt = document.createElement('option');
                    opt.value = trimmedName;
                    opt.text = trimmedName;
                    opt.selected = true; // Select it immediately
                    
                    // Add it to the list right above the "Add New" option
                    this.add(opt, this.options[this.options.length - 1]);
                } else {
                    // If user cancels or leaves blank, go back to default
                    this.value = "";
                }
            }
        };
        // --- NEW LOGIC ENDS HERE ---
    }
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function changeMonth(dir) {
    cMonth += dir;
    if (cMonth < 0) { cMonth = 11; cYear--; }
    if (cMonth > 11) { cMonth = 0; cYear++; }
    
    // This call to getDB() inside refresh() will now trigger the category copy!
    refresh(); 
}
function updatePref() {
    app.users[app.active].lang = document.getElementById('s-lang').value;
    app.users[app.active].cur = document.getElementById('s-cur').value;
    save(); refresh();
}

function updateChart(db) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const dataMap = {};
    db.trans.filter(t => t.type === 'expense').forEach(t => dataMap[t.cat] = (dataMap[t.cat] || 0) + t.amt);
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(dataMap),
            datasets: [{ data: Object.values(dataMap), backgroundColor: ['#4a148c','#7b1fa2','#9c27b0','#e1bee7','#6c5ce7'] }]
        },
        options: { maintainAspectRatio: false }
    });
}

function loadImg(input) {
    const reader = new FileReader();
    reader.onload = e => { app.users[app.active].pic = e.target.result; save(); init(); };
    reader.readAsDataURL(input.files[0]);
}

function saveProf() {
    const u = app.users[app.active];
    u.name = document.getElementById('p-name').value;
    u.details = {
        age: document.getElementById('p-age').value,
        dob: document.getElementById('p-dob').value,
        addr: document.getElementById('p-addr').value
    };
    save(); init(); alert("Profile Updated");
}
// --- TOOL MODAL HANDLERS ---
function openTool(id) {
    document.getElementById(id).classList.remove('hidden');
    if(id === 'cal-modal') renderCalendar();
}
function closeTool(id) {
    document.getElementById(id).classList.add('hidden');
}

// --- CALCULATOR LOGIC ---
function calcIn(v) { document.getElementById('calc-display').value += v; }
function calcClr() { document.getElementById('calc-display').value = ''; }
function calcRes() {
    try { 
        document.getElementById('calc-display').value = eval(document.getElementById('calc-display').value);
    } catch { alert("Error"); calcClr(); }
}

// --- CALENDAR LOGIC ---
let calViewDate = new Date();
function renderCalendar() {
    const grid = document.getElementById('cal-grid');
    const head = document.getElementById('cal-month-year');
    grid.innerHTML = "";
    
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    head.innerText = `${months[month]} ${year}`;

    ["S","M","T","W","T","F","S"].forEach(d => grid.innerHTML += `<div class="cal-day-name">${d}</div>`);

    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;

    for(let i=1; i<=lastDate; i++) {
        let isToday = (i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear());
        grid.innerHTML += `<div class="cal-date ${isToday ? 'cal-today' : ''}">${i}</div>`;
    }
}
function moveCal(dir) {
    calViewDate.setMonth(calViewDate.getMonth() + dir);
    renderCalendar();
}
function runAIAnalysis() {
    const db = getDB(); 
    const u = app.users[app.active];
    const sym = curSymbols[u.cur];

    const goal = parseFloat(document.getElementById('ai-goal').value) || 0;
    const fixed = parseFloat(document.getElementById('ai-fixed').value) || 0;
    const styleFactor = parseFloat(document.getElementById('ai-style').value);

    const totalIncome = db.trans.filter(t => t.type === 'income').reduce((s, x) => s + x.amt, 0);
    const categories = db.cats || [];

    const resultCard = document.getElementById('ai-result-card');
    const output = document.getElementById('ai-output-content');
    
    if (totalIncome === 0) {
        output.innerHTML = `
            <div style="text-align:center; padding:10px;">
                <i class="fas fa-info-circle" style="color:var(--purp); font-size:1.5rem;"></i>
                <p style="margin-top:10px;">No income found for <b>${langData[u.lang].months[cMonth]}</b>.<br>Please add your income in the Home tab first!</p>
            </div>`;
        resultCard.classList.remove('hidden');
        return; 
    }

    const remainingForSpend = totalIncome - fixed - goal;
    let html = `<h3 style="color:var(--purp)">✨ AI Plan for ${langData[u.lang].months[cMonth]}</h3><hr style="opacity:0.2; margin:10px 0;">`;

    if (remainingForSpend < 0) {
        html += `<p style="color:var(--red)">⚠️ <b>Deficit:</b> Your bills exceed income by ${sym}${Math.abs(remainingForSpend)}.</p>`;
    } else {
        // --- NEW PROPORTIONAL LOGIC START ---
        const totalDefinedLimits = categories.reduce((sum, c) => sum + (c.limit || 0), 0);

        // 1. ADD THIS LINE: Initialize a temporary storage for the plan
        window.tempAiPlan = {}; 

        html += `
            <p>✅ <b>Feasible:</b> Plan updated for ${langData[u.lang].months[cMonth]}.</p>
            <p>💰 <b>Daily Limit:</b> ${sym}${(remainingForSpend/30).toFixed(0)}</p>
            <div style="background:#f1f0ff; padding:12px; border-radius:8px; margin:15px 0;">
                <b>Category Targets:</b>
                <ul style="padding-left:20px;">
                    ${categories.length > 0 
                        ? categories.map(c => {
                            const weight = totalDefinedLimits > 0 ? (c.limit / totalDefinedLimits) : (1 / categories.length);
                            const suggestedMax = (remainingForSpend * weight).toFixed(0);
                            
                            // 2. ADD THIS LINE: Store the value so the button knows what to save
                            window.tempAiPlan[c.name] = parseFloat(suggestedMax);
                            
                            return `<li>${c.name}: Max ${sym}${suggestedMax}</li>`;
                        }).join('')
                        : "<li>No categories found for this month.</li>"}
                </ul>
            </div>`;
            
        // 3. ADD THESE LINES: Show the button in the action area
        document.getElementById('ai-action-area').innerHTML = `
            <button onclick="confirmAiImplementation()" class="btn-main" style="background:var(--green); margin-top:10px;">
                <i class="fas fa-check-double"></i> IMPLEMENT THIS PLAN
            </button>`;
            
        // --- NEW PROPORTIONAL LOGIC END ---
    }

    output.innerHTML = html;
    resultCard.classList.remove('hidden');
    resultCard.scrollIntoView({ behavior: 'smooth' });
}
function confirmAiImplementation() {
    if (!window.tempAiPlan) return;

    const confirmAction = confirm("Are you sure you want to update all your category limits with the AI suggested values? This will overwrite your current settings.");

    if (confirmAction) {
        const db = getDB();
        
        // Loop through the AI plan and update the actual database categories
        db.cats.forEach(cat => {
            if (window.tempAiPlan[cat.name] !== undefined) {
                cat.limit = window.tempAiPlan[cat.name];
            }
        });

        save();     // Save to LocalStorage
        refresh();  // Update UI and Charts
        
        alert("Success! Your category limits have been updated based on the AI strategy.");
        
        // Hide the button after implementation
        document.getElementById('ai-action-area').innerHTML = "";
    }
}