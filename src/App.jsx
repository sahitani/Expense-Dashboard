import React, { useState, useEffect } from "react";
import { Plus, TrendingUp, TrendingDown, Calendar, CreditCard, Menu, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pniwgtspagxcxugztrwt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaXdndHNwYWd4Y3h1Z3p0cnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyOTI4MTEsImV4cCI6MjA4NTg2ODgxMX0.jJN0KFxRebbmnFGaW29txBNkvcsCDwl2_h-k4Z9dxiA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORY_OPTIONS = [
  'Food',
  'Groceries',
  'Health',
  'Utilities & Bills',
  'Transport',
  'Rent',
  'Entertainment',
  'Shopping',
  'Investments',
  'Income',
  'Other'
];

const CATEGORY_MIGRATIONS = {
  'Salary': 'Income',
  'Other Income': 'Income',
  'Utilities': 'Utilities & Bills',
};

const detectCategory = (description) => {
  const lowerDesc = description.toLowerCase();

  const categoryKeywords = {
    'Investments': [
      'sip', 'mutual fund', 'mf', 'stocks', 'shares', 'nse', 'bse',
      'crypto', 'bitcoin', 'ppf', 'investment', 'zerodha', 'groww'
    ],
    'Food': ['food', 'restaurant', 'lunch', 'dinner', 'cafe', 'coffee', 'pizza', 'swiggy', 'zomato', 'burger', 'biryani', 'meal'],
    'Groceries': ['grocery', 'supermarket', 'milk', 'vegetables', 'fruits', 'eggs', 'veggies', 'bread', 'rice'],
    'Transport': ['uber', 'ola', 'taxi', 'bus', 'train', 'metro', 'fuel', 'petrol', 'cab', 'auto'],
    'Health': ['hospital', 'doctor', 'medicine', 'pharmacy', 'clinic', 'medical'],
    'Shopping': ['amazon', 'flipkart', 'shopping', 'clothes', 'shoes', 'myntra', 'purchase'],
    'Entertainment': ['movie', 'cinema', 'netflix', 'spotify', 'game', 'prime', 'show'],
    'Utilities & Bills': ['electricity', 'water', 'gas', 'internet', 'mobile', 'bill', 'wifi', 'haircut', 'salon'],
    'Income': ['salary', 'income', 'refund', 'cashback', 'bonus'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword)) {
        return category;
      }
    }
  }

  return 'Other';
};

export default function ExpenseTrackerApp() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false)
const [manualAmount, setManualAmount] = useState("")
const [manualMerchant, setManualMerchant] = useState("")
const [manualCategory, setManualCategory] = useState("Other")

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
  }, []);

  useEffect(() => {
    if (user) {
      runCategoryMigration(user.id).then(() => {
        loadTransactions();
        loadSubscriptions();
      });
    }
  }, [user]);

  const runCategoryMigration = async (userId) => {
    const { data: txns, error } = await supabase
      .from("transactions")
      .select("id, category")
      .eq("user_id", userId);

    if (error || !txns || txns.length === 0) return;

    const updates = txns.filter(t => t.category && CATEGORY_MIGRATIONS[t.category]);

    for (const tx of updates) {
      const newCategory = CATEGORY_MIGRATIONS[tx.category];
      await supabase
        .from("transactions")
        .update({ category: newCategory })
        .eq("id", tx.id);
    }
  };

  const loadTransactions = async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });
    setTransactions(data || []);

    if (data && data.length > 0) {
      backfillCategories(data);
    }
  };

  const loadSubscriptions = async () => {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("next_billing_date", { ascending: true });
    setSubscriptions(data || []);
  };

  const backfillCategories = async (txns) => {
    const needsBackfill = txns.filter(t => !t.category || t.category === '' || t.category === 'Expense');

    if (needsBackfill.length === 0) return;

    for (const tx of needsBackfill) {
      const detectedCategory = detectCategory(tx.description);
      await supabase
        .from("transactions")
        .update({ category: detectedCategory })
        .eq("id", tx.id);
    }

    const { data: updatedData } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });
    setTransactions(updatedData || []);
  };

  const login = async () => {
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setAuthError(error.message);
    else {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }
  };

  const register = async () => {
    setAuthError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    else {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTransactions([]);
    setSubscriptions([]);
  };

  const updateCategoryInline = async (transactionId, newCategory) => {
    const transaction = transactions.find(t => t.id === transactionId);
    
    await supabase
      .from("transactions")
      .update({ category: newCategory })
      .eq("id", transactionId);

    if (transaction && transaction.description) {
      await supabase
        .from("user_merchant_rules")
        .upsert({
          user_id: user.id,
          merchant: transaction.description,
          category: newCategory
        }, {
          onConflict: 'user_id,merchant'
        });
    }

    setTransactions(prevTransactions =>
      prevTransactions.map(t =>
        t.id === transactionId ? { ...t, category: newCategory } : t
      )
    );
    setEditingCategoryId(null);
  };

  // Filter transactions by selected month/year
  const currentMonthTransactions = transactions.filter((t) => {
    const transactionDate = new Date(t.date);
    return (
      transactionDate.getMonth() === selectedMonth &&
      transactionDate.getFullYear() === selectedYear
    );
  });

  // Calculate metrics
  const totalSpent = currentMonthTransactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  const totalCredit = currentMonthTransactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);

  const balanceLeft = totalCredit - totalSpent;

  // Calculate daily burn
  const now = new Date();
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const daysPassed = isCurrentMonth ? now.getDate() : new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const dailyBurn = daysPassed > 0 ? totalSpent / daysPassed : 0;

  // Get largest transaction
  const largestTransaction = currentMonthTransactions.length > 0 
    ? Math.max(...currentMonthTransactions.map(t => t.amount))
    : 0;

  // Filter transactions by category
  const filteredTransactions = selectedCategory === "all" 
    ? transactions 
    : transactions.filter(t => t.category === selectedCategory);
	
	// Add Manual Trasanction
	const addManualTransaction = async () => {

  if (!manualAmount || !manualMerchant) {
    alert("Amount and Merchant are required")
    return
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    amount: parseFloat(manualAmount),
    description: manualMerchant,
    category: manualCategory,
    type: "debit",
    raw_sms: "manual-entry",
    date: new Date().toISOString().split("T")[0],
  })

  if (!error) {
    setShowAddModal(false)
    setManualAmount("")
    setManualMerchant("")
    setManualCategory("Other")
    loadTransactions()
  }
}

  if (!user) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#0f172a",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
        }}
      >

        {/* Logo / Title */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "28px",
              fontWeight: "700",
              background: "linear-gradient(90deg,#3b82f6,#9333ea,#ec4899)",
              WebkitBackgroundClip: "text",
              color: "transparent"
            }}
          >
            Expense Tracker
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: "13px",
              marginTop: "6px"
            }}
          >
            Track spending from your SMS alerts
          </div>
        </div>

        {/* Login / Register Switch */}
        <div
          style={{
            display: "flex",
            marginBottom: "20px",
            background: "#020617",
            borderRadius: "10px",
            overflow: "hidden"
          }}
        >
          <button
            onClick={() => setAuthMode("login")}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              background: authMode === "login" ? "#3b82f6" : "transparent",
              color: "white",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            Login
          </button>

          <button
            onClick={() => setAuthMode("register")}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              background: authMode === "register" ? "#9333ea" : "transparent",
              color: "white",
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            Register
          </button>
        </div>

        {authError && (
          <div
            style={{
              background: "#7f1d1d",
              color: "#fecaca",
              padding: "10px",
              borderRadius: "8px",
              fontSize: "12px",
              marginBottom: "12px"
            }}
          >
            {authError}
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              color: "#94a3b8",
              fontSize: "12px",
              marginBottom: "4px"
            }}
          >
            Email
          </div>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #1e293b",
              background: "#020617",
              color: "white"
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: "18px" }}>
          <div
            style={{
              color: "#94a3b8",
              fontSize: "12px",
              marginBottom: "4px"
            }}
          >
            Password
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #1e293b",
              background: "#020617",
              color: "white"
            }}
          />
        </div>

        {/* Submit */}
        <button
          onClick={authMode === "login" ? login : register}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: "linear-gradient(90deg,#3b82f6,#9333ea,#ec4899)",
            color: "white",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          {authMode === "login" ? "Login" : "Create Account"}
        </button>

      </div>
    </div>
  );
}
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f5f5f5",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      paddingBottom: "80px"
    }}>
     {/* Main Content */}
<div style={{ maxWidth: "520px", margin: "0 auto", padding: "16px" }}>

  {/* App Header */}
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px"
    }}
  >
    <div
      style={{
        fontWeight: "700",
        fontSize: "18px",
        background: "linear-gradient(90deg,#3b82f6,#9333ea,#ec4899)",
        WebkitBackgroundClip: "text",
        color: "transparent"
      }}
    >
      Expense Tracker
    </div>

    <button
      onClick={logout}
      style={{
        border: "none",
        background: "#ef4444",
        color: "white",
        padding: "6px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        cursor: "pointer"
      }}
    >
      Logout
    </button>
  </div>
  
        
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

    {/* HERO BALANCE CARD */}
    <div
      style={{
        background: "linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)",
        borderRadius: "14px",
        padding: "18px",
        color: "white",
      }}
    >
      <div style={{ fontSize: "12px", opacity: 0.8 }}>TOTAL BALANCE</div>
      <div style={{ fontSize: "28px", fontWeight: "700", marginTop: "4px" }}>
        Rs. {balanceLeft.toFixed(2)}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "14px",
          fontSize: "13px",
          opacity: 0.9,
        }}
      >
        <div>
          <div>Expenses</div>
          <div style={{ fontWeight: "600" }}>Rs. {totalSpent.toFixed(1)}</div>
        </div>

        <div>
          <div>Income</div>
          <div style={{ fontWeight: "600" }}>Rs. {totalCredit.toFixed(1)}</div>
        </div>
      </div>
    </div>
	
	{showAddModal && (

<div
style={{
position:"fixed",
top:0,
left:0,
right:0,
bottom:0,
background:"rgba(0,0,0,0.6)",
display:"flex",
alignItems:"center",
justifyContent:"center",
zIndex:1000
}}
>

<div
style={{
background:"#0f172a",
padding:"20px",
borderRadius:"12px",
width:"320px",
color:"white"
}}
>

<h3 style={{marginBottom:"15px"}}>Add Transaction</h3>

<input
placeholder="Amount"
value={manualAmount}
onChange={(e)=>setManualAmount(e.target.value)}
style={{
width:"100%",
padding:"8px",
marginBottom:"10px",
borderRadius:"6px"
}}
/>

<input
placeholder="Merchant"
value={manualMerchant}
onChange={(e)=>setManualMerchant(e.target.value)}
style={{
width:"100%",
padding:"8px",
marginBottom:"10px",
borderRadius:"6px"
}}
/>

<select
value={manualCategory}
onChange={(e)=>setManualCategory(e.target.value)}
style={{
width:"100%",
padding:"8px",
marginBottom:"15px",
borderRadius:"6px"
}}
>

{CATEGORY_OPTIONS.map(cat=>(
<option key={cat}>{cat}</option>
))}

</select>

<div style={{display:"flex",gap:"10px"}}>

<button
onClick={addManualTransaction}
style={{
flex:1,
background:"#22c55e",
border:"none",
padding:"8px",
borderRadius:"6px",
color:"white"
}}
>
Save
</button>

<button
onClick={()=>setShowAddModal(false)}
style={{
flex:1,
background:"#ef4444",
border:"none",
padding:"8px",
borderRadius:"6px",
color:"white"
}}
>
Cancel
</button>

</div>

</div>
</div>
)}

    {/* AVAILABLE + DAILY BURN */}
    <div style={{ display: "flex", gap: "12px" }}>
    <div
        style={{
          flex: 1,
          background: "#f97316",
          color: "white",
          padding: "16px",
          borderRadius: "12px",
        }}
      >
        <div style={{ fontSize: "12px", opacity: 0.8 }}>Daily Burn</div>
        <div style={{ fontSize: "20px", fontWeight: "600" }}>
          Rs. {dailyBurn.toFixed(1)}
        </div>
      </div>
    </div>

    {/* SPENDING TREND */}
    <div
      style={{
        background: "#0f172a",
        borderRadius: "14px",
        padding: "18px",
        color: "white",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: "600" }}>
        Spending Trend
      </div>
      <div style={{ fontSize: "12px", opacity: 0.6 }}>
        Last 7 days activity
      </div>

      <div
        style={{
          height: "140px",
          marginTop: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.6,
        }}
      >
        Chart placeholder
      </div>
    </div>

    {/* INSIGHT CARDS */}
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          background: "#0f172a",
          padding: "16px",
          borderRadius: "12px",
          color: "white",
        }}
      >
        <div style={{ fontSize: "12px", opacity: 0.6 }}>
          Active Subscriptions
        </div>
        <div style={{ fontSize: "20px", fontWeight: "600" }}>
          {subscriptions.length}
        </div>
      </div>

      <div
        style={{
          background: "#0f172a",
          padding: "16px",
          borderRadius: "12px",
          color: "white",
        }}
      >
        <div style={{ fontSize: "12px", opacity: 0.6 }}>
          Transactions This Month
        </div>
        <div style={{ fontSize: "20px", fontWeight: "600" }}>
          {currentMonthTransactions.length}
        </div>
      </div>

      <div
        style={{
          background: "#0f172a",
          padding: "16px",
          borderRadius: "12px",
          color: "white",
        }}
      >
        <div style={{ fontSize: "12px", opacity: 0.6 }}>
          Largest Transaction
        </div>
        <div style={{ fontSize: "20px", fontWeight: "600" }}>
          Rs. {largestTransaction.toFixed(2)}
        </div>
      </div>
    </div>

  </div>
)}

 {/* Transactions Tab */}
{activeTab === "transactions" && (

  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
{/* HEADER */}
<div
  style={{
    background: "linear-gradient(90deg,#3b82f6,#9333ea,#ec4899)",
    borderRadius: "12px",
    padding: "14px",
    color: "white",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    justifyContent: "space-between"
  }}
>
  <span>All Transactions</span>
  <span>Download Last Month</span>
</div>

{/* CATEGORY SUMMARY */}
<div
  style={{
    display: "flex",
    gap: "10px",
    overflowX: "auto",
    paddingBottom: "6px"
  }}
>
  {CATEGORY_OPTIONS.map((cat, index) => {
    const count = transactions.filter(t => t.category === cat).length;

    const colors = [
      "#3b82f6","#8b5cf6","#f97316","#eab308",
      "#22c55e","#6366f1","#ec4899","#a855f7","#10b981"
    ];

    return (
      <div
        key={cat}
        style={{
          minWidth: "90px",
          padding: "10px",
          borderRadius: "10px",
          background: colors[index % colors.length],
          color: "white",
          fontSize: "11px",
          textAlign: "center"
        }}
      >
        <div>{cat}</div>
        <div style={{ fontWeight: "600", fontSize: "14px" }}>{count}</div>
      </div>
    );
  })}
</div>

{/* TRANSACTION LIST */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%"
  }}
>
{(() => {

const sortedTransactions = [...filteredTransactions]
.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
.slice(0, 10);

const groups = {};

sortedTransactions.forEach((t) => {
const d = new Date(
  new Date(t.created_at).toLocaleString("en-US", {
    timeZone: "Asia/Kolkata"
  })
);

const today = new Date();
const yesterday = new Date();
yesterday.setDate(today.getDate() - 1);

let label;

if (d.toDateString() === today.toDateString()) {
  label = "Today";
} else if (d.toDateString() === yesterday.toDateString()) {
  label = "Yesterday";
} else {
  label = d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric"
  });
}

if (!groups[label]) groups[label] = [];
groups[label].push(t);
});

return Object.entries(groups).map(([label, txns]) => (
<div key={label}>

  {/* DATE HEADER */}
  <div
    style={{
      color: "#94a3b8",
      fontSize: "12px",
      marginTop: "10px",
      marginBottom: "4px"
    }}
  >
    {label}
  </div>

  {txns.map((t) => (

    <div
      key={t.id}
      style={{
        background: "#0f172a",
        borderRadius: "12px",
        padding: "14px",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >

      {/* LEFT SECTION */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flex: 1,
          minWidth: 0
        }}
      >

        {/* ICON */}
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "#1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            flexShrink: 0
          }}
        >
          💳
        </div>

        {/* TEXT */}
        <div
          style={{
            flex: 1,
            minWidth: 0
          }}
        >

          {/* MERCHANT */}
          <div
            style={{
              fontWeight: "600",
              fontSize: "13px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {t.description}
          </div>

          {/* TAGS */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              marginTop: "3px",
              flexWrap: "wrap"
            }}
          >
{editingCategoryId === t.id ? (
<select
value={t.category || "Other"}
onChange={(e) => updateCategoryInline(t.id, e.target.value)}
onBlur={() => setEditingCategoryId(null)}
autoFocus
style={{
background: "#1e40af",
color: "white",
border: "none",
borderRadius: "6px",
fontSize: "10px",
padding: "2px 6px"
}}

>
{CATEGORY_OPTIONS.map(cat => (

  <option key={cat} value={cat}>
    {cat}
  </option>
))}
  </select>
) : (
  <span
    onClick={() => setEditingCategoryId(t.id)}
    style={{
      background: "#1e40af",
      padding: "2px 6px",
      borderRadius: "6px",
      fontSize: "10px",
      cursor: "pointer"
    }}
  >
    {t.category || t.type}
  </span>
)}
            <span
              style={{
                background: "#065f46",
                padding: "2px 6px",
                borderRadius: "6px",
                fontSize: "10px"
              }}
            >
              completed
            </span>

          </div>

        </div>
      </div>

      {/* RIGHT SECTION */}
      <div
        style={{
          textAlign: "right",
          flexShrink: 0,
          marginLeft: "10px"
        }}
      >

        <div
          style={{
            color: t.type === "debit" ? "#ef4444" : "#22c55e",
            fontWeight: "600",
            fontSize: "13px"
          }}
        >
          {t.type === "debit" ? "-" : "+"}${t.amount.toFixed(2)}
        </div>

        <div
          style={{
            fontSize: "10px",
            opacity: 0.6
          }}
        >
          {new Date(t.created_at).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
			timeZone: "Asia/Kolkata",
  hour12: true
          })}
        </div>

      </div>

    </div>

  ))}

</div>
));

})()}
</div>
  </div>
)}


        {/* Subscriptions Tab */}
{activeTab === "subscriptions" && (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

    {/* OVERVIEW HEADER */}
    <div
      style={{
        background: "linear-gradient(90deg,#3b82f6,#9333ea,#ec4899)",
        borderRadius: "14px",
        padding: "18px",
        color: "white",
      }}
    >
      <div style={{ fontSize: "12px", opacity: 0.8 }}>
        SUBSCRIPTION OVERVIEW
      </div>

      <div style={{ fontSize: "28px", fontWeight: "700", marginTop: "4px" }}>
        {subscriptions.length}
      </div>

      <div style={{ fontSize: "12px", opacity: 0.8 }}>
        Active subscriptions
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "16px",
        }}
      >
        <div>
          <div style={{ fontSize: "12px", opacity: 0.7 }}>Monthly</div>
          <div style={{ fontWeight: "600" }}>
            $
            {subscriptions
              .reduce((sum, s) => sum + s.amount, 0)
              .toFixed(2)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "12px", opacity: 0.7 }}>Yearly</div>
          <div style={{ fontWeight: "600" }}>
            $
            {(subscriptions.reduce((sum, s) => sum + s.amount, 0) * 12).toFixed(
              2
            )}
          </div>
        </div>
      </div>
    </div>

    {/* SUBSCRIPTION LIST */}
    {subscriptions.map((sub) => {
      const nextBilling = new Date(sub.next_billing_date);
      const today = new Date();
      const daysUntil = Math.ceil(
        (nextBilling - today) / (1000 * 60 * 60 * 24)
      );

      const progress =
        100 - Math.min(Math.max(daysUntil * 5, 0), 100);

      const barColor =
        daysUntil <= 5 ? "#f97316" : "#10b981";

      return (
        <div
          key={sub.id}
          style={{
            background: "#0f172a",
            borderRadius: "12px",
            padding: "16px",
            color: "white",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <div>
              <div style={{ fontWeight: "600" }}>
                {sub.merchant}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  opacity: 0.6,
                }}
              >
                {sub.billing_cycle}
              </div>
            </div>

            <div style={{ fontWeight: "600" }}>
              ${sub.amount.toFixed(2)}
            </div>
          </div>

          {/* BILLING INFO */}
          <div
            style={{
              fontSize: "12px",
              opacity: 0.7,
              marginBottom: "6px",
            }}
          >
            {daysUntil} days until billing
          </div>

          {/* PROGRESS BAR */}
          <div
            style={{
              height: "6px",
              background: "#1e293b",
              borderRadius: "6px",
              overflow: "hidden",
              marginBottom: "10px",
            }}
          >
           <div
  style={{
    width: `${progress}%`,
    background: barColor,
    height: "100%",
  }}
/>
          </div>

          {/* NEXT BILLING */}
          <div
            style={{
              fontSize: "12px",
              opacity: 0.6,
              marginBottom: "8px",
            }}
          >
            Next billing:{" "}
            {nextBilling.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>

          <button
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: "6px",
              border: "1px solid #334155",
              background: "transparent",
              color: "white",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Manage Subscription
          </button>
        </div>
      );
    })}
  </div>
)}
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "white",
        borderTop: "1px solid #e5e5e5",
        padding: "12px 0",
        display: "flex",
        justifyContent: "space-around",
        zIndex: 100
      }}>
        <button
          onClick={() => setActiveTab("dashboard")}
          style={{
            background: "none",
            border: "none",
            padding: "8px 24px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            color: activeTab === "dashboard" ? "#3b82f6" : "#999"
          }}
        >
          <span style={{ fontSize: "20px" }}>📊</span>
          <span style={{ fontSize: "11px", fontWeight: "500" }}>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab("subscriptions")}
          style={{
            background: "none",
            border: "none",
            padding: "8px 24px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            color: activeTab === "subscriptions" ? "#3b82f6" : "#999"
          }}
        >
          <span style={{ fontSize: "20px" }}>🔄</span>
          <span style={{ fontSize: "11px", fontWeight: "500" }}>Subscriptions</span>
        </button>

        <button
          onClick={() => setActiveTab("transactions")}
          style={{
            background: "none",
            border: "none",
            padding: "8px 24px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            color: activeTab === "transactions" ? "#3b82f6" : "#999"
          }}
        >
          <span style={{ fontSize: "20px" }}>💳</span>
          <span style={{ fontSize: "11px", fontWeight: "500" }}>Transactions</span>
        </button>
      </div>
	  
<button
onClick={() => setShowAddModal(true)}
style={{
position: "fixed",
bottom: "90px",
right: "20px",
width: "60px",
height: "60px",
minWidth: "60px",
minHeight: "60px",
maxWidth: "60px",
maxHeight: "60px",
borderRadius: "50%",
background: "linear-gradient(135deg,#22c55e,#16a34a)",
color: "white",
border: "none",
display: "flex",
alignItems: "center",
justifyContent: "center",
boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
cursor: "pointer",
zIndex: 1000,
padding: 0
}}
>
<Plus size={28}/>
</button>
    </div>
  );
}
