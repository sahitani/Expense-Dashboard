import React, { useState, useEffect } from "react";
import { Plus, LogOut, ChevronLeft, Save, Edit2, Trash2, Eye, EyeOff } from "lucide-react";
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

// Categories that need migration: old value -> new value
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


const PieChart = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;

  const colors = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];

  let currentAngle = 0;
  const radius = 120;
  const centerX = 150;
  const centerY = 150;

  const slices = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const sliceAngle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;

    const path = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    currentAngle = endAngle;

    return {
      path,
      color: colors[index % colors.length],
      percentage,
      label: item.name
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
      <svg width="300" height="300" viewBox="0 0 300 300">
        {slices.map((slice, index) => (
          <path
            key={index}
            d={slice.path}
            fill={slice.color}
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div style={{ width: '100%' }}>
        {slices.map((slice, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              marginBottom: '8px',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  background: slice.color
                }}
              />
              <span style={{ fontWeight: '600', color: '#1a202c' }}>{slice.label}</span>
            </div>
            <span style={{ fontWeight: '700', color: '#4b5563' }}>
              {slice.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};


export default function ExpenseTrackerApp() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [view, setView] = useState("home");
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [editingTx, setEditingTx] = useState(null);
  const [editCategory, setEditCategory] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Manual transaction entry form states
  const [manualAmount, setManualAmount] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualType, setManualType] = useState("debit");
  const [manualCategory, setManualCategory] = useState("Other");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  
  // Month and Year filter states
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [subscriptions, setSubscriptions] = useState([]);

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

  // One-time migration: normalizes outdated categories for the logged-in user
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
    setLoading(true);
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
    setLoading(false);
  };

  const register = async () => {
    setLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    else {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTransactions([]);
  };

  const parseText = (t) => {
    const amountMatch = t.match(/\d+(\.\d+)?/);
    const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;
    const description = t.replace(/\d+(\.\d+)?/, "").trim();
    const isCredit = /salary|income|refund|cashback|bonus/i.test(t);

    const category = detectCategory(description);

    return {
      amount,
      description,
      type: isCredit ? "credit" : "debit",
      category: category,
    };
  };

  const addOrUpdateTransaction = async () => {
    const parsed = parseText(text);
    if (!parsed.amount) {
      alert("Please include an amount");
      return;
    }

    if (editingTx) {
      await supabase
        .from("transactions")
        .update({
          amount: parsed.amount,
          description: parsed.description,
          type: parsed.type,
          category: editCategory || parsed.category,
        })
        .eq("id", editingTx.id);
      setEditingTx(null);
      setEditCategory("");
    } else {
      await supabase.from("transactions").insert({
        user_id: user.id,
        amount: parsed.amount,
        description: parsed.description,
        type: parsed.type,
        category: parsed.category,
        date: new Date().toISOString().split("T")[0],
      });
    }

    setText("");
    setView("home");
    loadTransactions();
  };

  const deleteTransaction = async (id) => {
    await supabase.from("transactions").delete().eq("id", id);
    loadTransactions();
  };

// Replace the existing updateCategoryInline function with this:

const updateCategoryInline = async (transactionId, newCategory) => {
  // Find the transaction to get merchant name
  const transaction = transactions.find(t => t.id === transactionId);
  
  await supabase
    .from("transactions")
    .update({ category: newCategory })
    .eq("id", transactionId);

  // Save merchant rule for future transactions
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

  const saveManualTransaction = async () => {
    // Validation
    if (!manualAmount || parseFloat(manualAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (!manualDescription.trim()) {
      alert("Please enter a description");
      return;
    }

    try {
      await supabase.from("transactions").insert({
        user_id: user.id,
        amount: parseFloat(manualAmount),
        description: manualDescription.trim(),
        type: manualType,
        category: manualCategory,
        date: manualDate,
        transaction_ref: null,
        raw_sms: null,
      });

      // Reset form
      setManualAmount("");
      setManualDescription("");
      setManualType("debit");
      setManualCategory("Other");
      setManualDate(new Date().toISOString().split("T")[0]);
      
      setView("home");
      loadTransactions();
    } catch (error) {
      alert("Error saving transaction: " + error.message);
    }
  };

  // Filter transactions to only include selected month and year
  const currentMonthTransactions = transactions.filter((t) => {
    const transactionDate = new Date(t.date);
    return (
      transactionDate.getMonth() === selectedMonth &&
      transactionDate.getFullYear() === selectedYear
    );
  });

  const totalSpent = currentMonthTransactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  const totalCredit = currentMonthTransactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);

  const getCategoryBreakdown = () => {
    const debitTransactions = currentMonthTransactions.filter((t) => t.type === "debit");
    const categoryTotals = {};

    debitTransactions.forEach((t) => {
      const cat = t.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const classifySubscription = (merchant) => {
    const merchantLower = merchant.toLowerCase();
    
    const productivity = ['linkedin', 'naukri', 'chatgpt', 'claude', 'canva', 'google'];
    const entertainment = ['netflix', 'prime', 'spotify', 'hotstar', 'apple music', 'youtube'];
    
    if (productivity.some(p => merchantLower.includes(p))) return 'Productivity';
    if (entertainment.some(e => merchantLower.includes(e))) return 'Entertainment';
    return 'Other';
  };

  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}>
        <div style={{
          background: "white",
          borderRadius: "24px",
          padding: "40px 32px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
        }}>
          <h1 style={{
            fontSize: "32px",
            fontWeight: "700",
            marginBottom: "8px",
            color: "#1a202c",
            textAlign: "center"
          }}>
            Expense Tracker
          </h1>
          <p style={{
            color: "#718096",
            marginBottom: "32px",
            textAlign: "center",
            fontSize: "15px"
          }}>
            Track your finances effortlessly
          </p>

          <div style={{
            display: "flex",
            marginBottom: "28px",
            borderBottom: "2px solid #e2e8f0",
            gap: "8px"
          }}>
            <button
              onClick={() => setAuthMode("login")}
              style={{
                flex: 1,
                padding: "12px",
                background: "none",
                border: "none",
                borderBottom: authMode === "login" ? "3px solid #667eea" : "none",
                color: authMode === "login" ? "#667eea" : "#718096",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "16px",
                transition: "all 0.2s"
              }}
            >
              Login
            </button>
            <button
              onClick={() => setAuthMode("register")}
              style={{
                flex: 1,
                padding: "12px",
                background: "none",
                border: "none",
                borderBottom: authMode === "register" ? "3px solid #667eea" : "none",
                color: authMode === "register" ? "#667eea" : "#718096",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "16px",
                transition: "all 0.2s"
              }}
            >
              Register
            </button>
          </div>

          {authError && (
            <div style={{
              padding: "12px 16px",
              marginBottom: "20px",
              background: "#fee2e2",
              border: "1px solid #ef4444",
              borderRadius: "12px",
              color: "#991b1b",
              fontSize: "14px",
              fontWeight: "500"
            }}>
              {authError}
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#4a5568",
              fontWeight: "500",
              fontSize: "14px"
            }}>
              Email
            </label>
            <input
              placeholder="your@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: "16px",
                outline: "none",
                transition: "border 0.2s",
                fontFamily: "inherit"
              }}
              onFocus={(e) => e.target.style.border = "2px solid #667eea"}
              onBlur={(e) => e.target.style.border = "2px solid #e2e8f0"}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#4a5568",
              fontWeight: "500",
              fontSize: "14px"
            }}>
              Password
            </label>
            <input
              placeholder="Enter your password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: "16px",
                outline: "none",
                transition: "border 0.2s",
                fontFamily: "inherit"
              }}
              onFocus={(e) => e.target.style.border = "2px solid #667eea"}
              onBlur={(e) => e.target.style.border = "2px solid #e2e8f0"}
            />
          </div>

          <button
            onClick={authMode === "login" ? login : register}
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px",
              background: loading ? "#9ca3af" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)"
            }}
            onMouseOver={(e) => !loading && (e.target.style.transform = "translateY(-2px)")}
            onMouseOut={(e) => e.target.style.transform = "translateY(0)"}
          >
            {loading ? "Please wait..." : (authMode === "login" ? "Login" : "Register")}
          </button>
        </div>
      </div>
    );
  }

  if (view === "chart") {
    const categoryData = getCategoryBreakdown();

    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        paddingBottom: "40px"
      }}>
        <div style={{
          background: "white",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
        }}>
          <button
            onClick={() => setView("home")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
              alignItems: "center"
            }}
          >
            <ChevronLeft size={24} color="#1a202c" />
          </button>
          <h2 style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: "700",
            color: "#1a202c"
          }}>
            Spending by Category
          </h2>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{
              margin: "0 0 20px 0",
              fontSize: "18px",
              fontWeight: "700",
              color: "#1a202c",
              textAlign: "center"
            }}>
              Total Spent: ₹{totalSpent.toFixed(2)}
            </h3>

            {categoryData.length > 0 ? (
              <PieChart data={categoryData} />
            ) : (
              <p style={{
                textAlign: "center",
                color: "#718096",
                fontSize: "16px",
                padding: "40px 0"
              }}>
                No spending data available
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "add") {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}>
        <div style={{
          background: "white",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
        }}>
          <button
            onClick={() => {
              setView("home");
              setManualAmount("");
              setManualDescription("");
              setManualType("debit");
              setManualCategory("Other");
              setManualDate(new Date().toISOString().split("T")[0]);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
              alignItems: "center"
            }}
          >
            <ChevronLeft size={24} color="#1a202c" />
          </button>
          <h2 style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: "700",
            color: "#1a202c"
          }}>
            Add Transaction
          </h2>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
          }}>
            
            {/* Amount Field */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                color: "#4a5568",
                fontWeight: "600",
                fontSize: "14px"
              }}>
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                style={{
                  width: "100%",
                  padding: "16px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "12px",
                  fontSize: "16px",
                  outline: "none",
                  transition: "border 0.2s",
                  fontFamily: "inherit"
                }}
                onFocus={(e) => e.target.style.border = "2px solid #667eea"}
                onBlur={(e) => e.target.style.border = "2px solid #e2e8f0"}
              />
            </div>

            {/* Description Field */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                color: "#4a5568",
                fontWeight: "600",
                fontSize: "14px"
              }}>
                Description / Merchant *
              </label>
              <input
                type="text"
                placeholder="e.g., Coffee Shop, Grocery Store"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                style={{
                  width: "100%",
                  padding: "16px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "12px",
                  fontSize: "16px",
                  outline: "none",
                  transition: "border 0.2s",
                  fontFamily: "inherit"
                }}
                onFocus={(e) => e.target.style.border = "2px solid #667eea"}
                onBlur={(e) => e.target.style.border = "2px solid #e2e8f0"}
              />
            </div>

            {/* Type Field */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                color: "#4a5568",
                fontWeight: "600",
                fontSize: "14px"
              }}>
                Type
              </label>
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "16px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "12px",
                  fontSize: "16px",
                  outline: "none",
                  transition: "border 0.2s",
                  fontFamily: "inherit",
                  background: "white",
                  cursor: "pointer"
                }}
                onFocus={(e) => e.target.style.border = "2px solid #667eea"}
                onBlur={(e) => e.target.style.border = "2px solid #e2e8f0"}
              >
                <option value="debit">Debit (Money Spent)</option>
                <option value="credit">Credit (Money Received)</option>
              </select>
            </div>

            {/* Category Field */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                color: "#4a5568",
                fontWeight: "600",
                fontSize: "14px"
              }}>
                Category
              </label>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "16px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "12px",
                  fontSize: "16px",
                  outline: "none",
                  transition: "border 0.2s",
                  fontFamily: "inherit",
                  background: "white",
                  cursor: "pointer"
                }}
                onFocus={(e) => e.target.style.border = "2px solid #667eea"}
                onBlur={(e) => e.target.style.border = "2px solid #e2e8f0"}
              >
                {CATEGORY_OPTIONS.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Date Field */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                marginBottom: "8px",
                color: "#4a5568",
                fontWeight: "600",
                fontSize: "14px"
              }}>
                Date
              </label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "16px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "12px",
                  fontSize: "16px",
                  outline: "none",
                  transition: "border 0.2s",
                  fontFamily: "inherit",
                  cursor: "pointer"
                }}
                onFocus={(e) => e.target.style.border = "2px solid #667eea"}
                onBlur={(e) => e.target.style.border = "2px solid #e2e8f0"}
              />
            </div>

            {/* Save Button */}
            <button
              onClick={saveManualTransaction}
              style={{
                width: "100%",
                padding: "16px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "transform 0.2s",
                boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)"
              }}
              onMouseOver={(e) => e.target.style.transform = "translateY(-2px)"}
              onMouseOut={(e) => e.target.style.transform = "translateY(0)"}
            >
              <Save size={20} />
              Save Transaction
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "transactions") {
    const itemsPerPage = 10;
    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentTransactions = transactions.slice(startIndex, endIndex);

    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        paddingBottom: "100px"
      }}>
        <div style={{
          background: "white",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
        }}>
          <button
            onClick={() => setView("home")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
              alignItems: "center"
            }}
          >
            <ChevronLeft size={24} color="#1a202c" />
          </button>
          <h2 style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: "700",
            color: "#1a202c"
          }}>
            All Transactions
          </h2>
        </div>

        <div style={{ padding: "20px" }}>
          {currentTransactions.length === 0 ? (
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: "48px 24px",
              textAlign: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
            }}>
              <p style={{
                margin: 0,
                color: "#718096",
                fontSize: "16px"
              }}>
                No transactions yet. Add your first one!
              </p>
            </div>
          ) : (
            <>
              {currentTransactions.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: "white",
                    borderRadius: "16px",
                    padding: "16px",
                    marginBottom: "12px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px"
                    }}>
                      <p style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1a202c"
                      }}>
                        {t.description}
                      </p>
                      {editingCategoryId === t.id ? (
                        <select
                          value={t.category || 'Other'}
                          onChange={(e) => updateCategoryInline(t.id, e.target.value)}
                          onBlur={() => setEditingCategoryId(null)}
                          autoFocus
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            background: t.type === "debit" ? "#fee2e2" : "#d1fae5",
                            color: t.type === "debit" ? "#991b1b" : "#065f46",
                            fontWeight: "600",
                            border: "1px solid #667eea",
                            outline: "none",
                            cursor: "pointer"
                          }}
                        >
                          {CATEGORY_OPTIONS.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={() => setEditingCategoryId(t.id)}
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            background: t.type === "debit" ? "#fee2e2" : "#d1fae5",
                            color: t.type === "debit" ? "#991b1b" : "#065f46",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}>
                          {t.category || t.type}
                        </span>
                      )}
                    </div>
                    <p style={{
                      margin: "4px 0 0 0",
                      fontSize: "12px",
                      color: "#718096"
                    }}>
                      {new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    <p style={{
                      margin: "4px 0 0 0",
                      fontSize: "20px",
                      fontWeight: "700",
                      color: t.type === "debit" ? "#ef4444" : "#10b981"
                    }}>
                      {t.type === "debit" ? "-" : "+"}₹{t.amount.toFixed(2)}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => {
                        setEditingTx(t);
                        setText(`${t.description} ${t.amount}`);
                        setEditCategory(t.category || "");
                        setView("add");
                      }}
                      style={{
                        background: "#3b82f6",
                        border: "none",
                        borderRadius: "10px",
                        padding: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Edit2 size={16} color="white" />
                    </button>
                    <button
                      onClick={() => deleteTransaction(t.id)}
                      style={{
                        background: "#ef4444",
                        border: "none",
                        borderRadius: "10px",
                        padding: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Trash2 size={16} color="white" />
                    </button>
                  </div>
                </div>
              ))}

              {totalPages > 1 && (
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "24px"
                }}>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: "10px 16px",
                      background: currentPage === 1 ? "#e2e8f0" : "white",
                      color: currentPage === 1 ? "#a0aec0" : "#667eea",
                      border: "2px solid #667eea",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        padding: "10px 14px",
                        background: currentPage === page ? "#667eea" : "white",
                        color: currentPage === page ? "white" : "#667eea",
                        border: "2px solid #667eea",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: "10px 16px",
                      background: currentPage === totalPages ? "#e2e8f0" : "white",
                      color: currentPage === totalPages ? "#a0aec0" : "#667eea",
                      border: "2px solid #667eea",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (view === "subscriptions") {
    const productivitySubs = subscriptions.filter(s => classifySubscription(s.merchant) === 'Productivity');
    const entertainmentSubs = subscriptions.filter(s => classifySubscription(s.merchant) === 'Entertainment');
    const otherSubs = subscriptions.filter(s => classifySubscription(s.merchant) === 'Other');

    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        paddingBottom: "100px"
      }}>
        <div style={{
          background: "white",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
        }}>
          <button
            onClick={() => setView("home")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
              alignItems: "center"
            }}
          >
            <ChevronLeft size={24} color="#1a202c" />
          </button>
          <h2 style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: "700",
            color: "#1a202c"
          }}>
            Subscriptions
          </h2>
        </div>

        <div style={{ padding: "20px" }}>
          {subscriptions.length === 0 ? (
            <div style={{
              background: "white",
              borderRadius: "16px",
              padding: "48px 24px",
              textAlign: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
            }}>
              <p style={{
                margin: 0,
                color: "#718096",
                fontSize: "16px"
              }}>
                No subscriptions detected yet.
              </p>
            </div>
          ) : (
            <>
              {/* Productivity Section */}
              {productivitySubs.length > 0 && (
                <>
                  <h3 style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "white",
                    marginBottom: "12px",
                    marginTop: "0"
                  }}>
                    Productivity
                  </h3>
                  {productivitySubs.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        background: "white",
                        borderRadius: "16px",
                        padding: "20px",
                        marginBottom: "12px",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px"
                      }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#1a202c"
                        }}>
                          {sub.merchant}
                        </h4>
                        <span style={{
                          fontSize: "11px",
                          padding: "4px 12px",
                          borderRadius: "12px",
                          background: sub.status === 'active' ? "#d1fae5" : "#fee2e2",
                          color: sub.status === 'active' ? "#065f46" : "#991b1b",
                          fontWeight: "600"
                        }}>
                          {sub.status}
                        </span>
                      </div>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <p style={{
                          margin: 0,
                          fontSize: "20px",
                          fontWeight: "700",
                          color: "#667eea"
                        }}>
                          ₹{sub.amount.toFixed(2)} / {sub.billing_cycle}
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#718096"
                        }}>
                          Next billing: {new Date(sub.next_billing_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Entertainment Section */}
              {entertainmentSubs.length > 0 && (
                <>
                  <h3 style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "white",
                    marginBottom: "12px",
                    marginTop: "24px"
                  }}>
                    Entertainment
                  </h3>
                  {entertainmentSubs.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        background: "white",
                        borderRadius: "16px",
                        padding: "20px",
                        marginBottom: "12px",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px"
                      }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#1a202c"
                        }}>
                          {sub.merchant}
                        </h4>
                        <span style={{
                          fontSize: "11px",
                          padding: "4px 12px",
                          borderRadius: "12px",
                          background: sub.status === 'active' ? "#d1fae5" : "#fee2e2",
                          color: sub.status === 'active' ? "#065f46" : "#991b1b",
                          fontWeight: "600"
                        }}>
                          {sub.status}
                        </span>
                      </div>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <p style={{
                          margin: 0,
                          fontSize: "20px",
                          fontWeight: "700",
                          color: "#667eea"
                        }}>
                          ₹{sub.amount.toFixed(2)} / {sub.billing_cycle}
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#718096"
                        }}>
                          Next billing: {new Date(sub.next_billing_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Other Section */}
              {otherSubs.length > 0 && (
                <>
                  <h3 style={{
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "white",
                    marginBottom: "12px",
                    marginTop: "24px"
                  }}>
                    Other
                  </h3>
                  {otherSubs.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        background: "white",
                        borderRadius: "16px",
                        padding: "20px",
                        marginBottom: "12px",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08)"
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px"
                      }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#1a202c"
                        }}>
                          {sub.merchant}
                        </h4>
                        <span style={{
                          fontSize: "11px",
                          padding: "4px 12px",
                          borderRadius: "12px",
                          background: sub.status === 'active' ? "#d1fae5" : "#fee2e2",
                          color: sub.status === 'active' ? "#065f46" : "#991b1b",
                          fontWeight: "600"
                        }}>
                          {sub.status}
                        </span>
                      </div>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <p style={{
                          margin: 0,
                          fontSize: "20px",
                          fontWeight: "700",
                          color: "#667eea"
                        }}>
                          ₹{sub.amount.toFixed(2)} / {sub.billing_cycle}
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#718096"
                        }}>
                          Next billing: {new Date(sub.next_billing_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      paddingBottom: "100px"
    }}>
      <div style={{
        background: "white",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: "700",
            color: "#1a202c"
          }}>
            Dashboard
          </h1>
          <p style={{
            margin: "4px 0 0 0",
            fontSize: "14px",
            color: "#718096"
          }}>
            {user.email}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => setShowAmounts(!showAmounts)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
              alignItems: "center"
            }}
          >
            {showAmounts ? <EyeOff size={24} color="#667eea" /> : <Eye size={24} color="#667eea" />}
          </button>
          <button
            onClick={logout}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
              alignItems: "center"
            }}
          >
            <LogOut size={24} color="#ef4444" />
          </button>
        </div>
      </div>

      <div style={{ padding: "20px" }}>
        {/* Month and Year Filters */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          background: "white",
          padding: "16px",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}>
          <div style={{ flex: 1 }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#4a5568",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                outline: "none",
                cursor: "pointer",
                background: "white",
                color: "#1a202c"
              }}
            >
              <option value={0}>January</option>
              <option value={1}>February</option>
              <option value={2}>March</option>
              <option value={3}>April</option>
              <option value={4}>May</option>
              <option value={5}>June</option>
              <option value={6}>July</option>
              <option value={7}>August</option>
              <option value={8}>September</option>
              <option value={9}>October</option>
              <option value={10}>November</option>
              <option value={11}>December</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#4a5568",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                outline: "none",
                cursor: "pointer",
                background: "white",
                color: "#1a202c"
              }}
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "24px"
        }}>
          <div
            onClick={() => setView("chart")}
            style={{
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 4px 16px rgba(239, 68, 68, 0.3)",
              cursor: "pointer",
              transition: "transform 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
            onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
          >
            <p style={{
              margin: "0 0 8px 0",
              fontSize: "13px",
              color: "rgba(255,255,255,0.9)",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Total Spent
            </p>
            <p style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: "700",
              color: "white"
            }}>
              {showAmounts ? `₹${totalSpent.toFixed(2)}` : "₹ ******"}
            </p>
          </div>

          <div style={{
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            borderRadius: "16px",
            padding: "20px",
            boxShadow: "0 4px 16px rgba(16, 185, 129, 0.3)"
          }}>
            <p style={{
              margin: "0 0 8px 0",
              fontSize: "13px",
              color: "rgba(255,255,255,0.9)",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Total Credit
            </p>
            <p style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: "700",
              color: "white"
            }}>
              {showAmounts ? `₹${totalCredit.toFixed(2)}` : "₹ ******"}
            </p>
          </div>

          <div style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            borderRadius: "16px",
            padding: "20px",
            gridColumn: "1 / -1",
            boxShadow: "0 4px 16px rgba(59, 130, 246, 0.3)"
          }}>
            <p style={{
              margin: "0 0 8px 0",
              fontSize: "13px",
              color: "rgba(255,255,255,0.9)",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              Amount Left
            </p>
            <p style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: "700",
              color: "white"
            }}>
              {showAmounts ? `₹${(totalCredit - totalSpent).toFixed(2)}` : "₹ ******"}
            </p>
          </div>

          {/* Monthly Burn Projection Card */}
          {(() => {
            // Calculate days passed in selected month
            const today = new Date();
            const isCurrentMonth = selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
            const daysPassed = isCurrentMonth ? today.getDate() : new Date(selectedYear, selectedMonth + 1, 0).getDate();
            
            // Calculate total days in selected month
            const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // NEW: totalSpent excluding investments
  const totalSpent = transactions
    .filter(t => t.type === "debit" && t.category !== "Investment")
    .reduce((sum, t) => sum + t.amount, 0);
            
            // Calculate daily average spend
            const dailyAvgSpend = daysPassed > 0 ? totalSpent / daysPassed : 0;
            
            // Calculate projected month spend
            const projectedMonthSpend = dailyAvgSpend * totalDaysInMonth;
            
            return (
              <div style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                borderRadius: "16px",
                padding: "20px",
                gridColumn: "1 / -1",
                boxShadow: "0 4px 16px rgba(245, 158, 11, 0.3)"
              }}>
                <p style={{
                  margin: "0 0 12px 0",
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.9)",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  Projected Month Spend
                </p>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px"
                }}>
                  <div>
                    <p style={{
                      margin: "0 0 4px 0",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.8)",
                      fontWeight: "500"
                    }}>
                      Daily Avg Spend
                    </p>
                    <p style={{
                      margin: 0,
                      fontSize: "20px",
                      fontWeight: "700",
                      color: "white"
                    }}>
                      {showAmounts ? `₹${dailyAvgSpend.toFixed(2)}` : "₹ ******"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{
                      margin: "0 0 4px 0",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.8)",
                      fontWeight: "500"
                    }}>
                      Projected Total
                    </p>
                    <p style={{
                      margin: 0,
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "white"
                    }}>
                      {showAmounts ? `₹${projectedMonthSpend.toFixed(2)}` : "₹ ******"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <h3 style={{
          fontSize: "18px",
          fontWeight: "700",
          color: "white",
          marginBottom: "16px"
        }}>
          Recent Transactions
        </h3>

        {transactions.length === 0 ? (
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "48px 24px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
          }}>
            <p style={{
              margin: 0,
              color: "#718096",
              fontSize: "16px"
            }}>
              No transactions yet. Add your first one!
            </p>
          </div>
        ) : (
          <div>
            {transactions.slice(0, 10).map((t) => (
              <div
                key={t.id}
                style={{
                  background: "white",
                  borderRadius: "16px",
                  padding: "16px",
                  marginBottom: "12px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px"
                  }}>
                    <p style={{
                      margin: 0,
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1a202c"
                    }}>
                      {t.description}
                    </p>
                    {editingCategoryId === t.id ? (
                      <select
                        value={t.category || 'Other'}
                        onChange={(e) => updateCategoryInline(t.id, e.target.value)}
                        onBlur={() => setEditingCategoryId(null)}
                        autoFocus
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          background: t.type === "debit" ? "#fee2e2" : "#d1fae5",
                          color: t.type === "debit" ? "#991b1b" : "#065f46",
                          fontWeight: "600",
                          border: "1px solid #667eea",
                          outline: "none",
                          cursor: "pointer"
                        }}
                      >
                        {CATEGORY_OPTIONS.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        onClick={() => setEditingCategoryId(t.id)}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          background: t.type === "debit" ? "#fee2e2" : "#d1fae5",
                          color: t.type === "debit" ? "#991b1b" : "#065f46",
                          fontWeight: "600",
                          cursor: "pointer"
                        }}>
                        {t.category || t.type}
                      </span>
                    )}
                  </div>
                  <p style={{
                    margin: "4px 0 0 0",
                    fontSize: "12px",
                    color: "#718096"
                  }}>
                    {new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  <p style={{
                    margin: "4px 0 0 0",
                    fontSize: "20px",
                    fontWeight: "700",
                    color: t.type === "debit" ? "#ef4444" : "#10b981"
                  }}>
                    {t.type === "debit" ? "-" : "+"}₹{t.amount.toFixed(2)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setEditingTx(t);
                      setText(`${t.description} ${t.amount}`);
                      setEditCategory(t.category || "");
                      setView("add");
                    }}
                    style={{
                      background: "#3b82f6",
                      border: "none",
                      borderRadius: "10px",
                      padding: "10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Edit2 size={16} color="white" />
                  </button>
                  <button
                    onClick={() => deleteTransaction(t.id)}
                    style={{
                      background: "#ef4444",
                      border: "none",
                      borderRadius: "10px",
                      padding: "10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Trash2 size={16} color="white" />
                  </button>
                </div>
              </div>
            ))}
            {transactions.length > 10 && (
              <button
                onClick={() => {
                  setCurrentPage(1);
                  setView("transactions");
                }}
                style={{
                  width: "100%",
                  padding: "16px",
                  marginTop: "16px",
                  background: "white",
                  color: "#667eea",
                  border: "2px solid #667eea",
                  borderRadius: "12px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}
                onMouseOver={(e) => {
                  e.target.style.background = "#667eea";
                  e.target.style.color = "white";
                }}
                onMouseOut={(e) => {
                  e.target.style.background = "white";
                  e.target.style.color = "#667eea";
                }}
              >
                View All Transactions
              </button>
            )}
            {subscriptions.length > 0 && (
              <button
                onClick={() => setView("subscriptions")}
                style={{
                  width: "100%",
                  padding: "16px",
                  marginTop: "16px",
                  background: "white",
                  color: "#667eea",
                  border: "2px solid #667eea",
                  borderRadius: "12px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}
                onMouseOver={(e) => {
                  e.target.style.background = "#667eea";
                  e.target.style.color = "white";
                }}
                onMouseOut={(e) => {
                  e.target.style.background = "white";
                  e.target.style.color = "#667eea";
                }}
              >
                View Subscriptions ({subscriptions.length})
              </button>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => setView("add")}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          border: "none",
          boxShadow: "0 8px 24px rgba(102, 126, 234, 0.5)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s"
        }}
        onMouseOver={(e) => {
          e.target.style.transform = "scale(1.1)";
          e.target.style.boxShadow = "0 12px 32px rgba(102, 126, 234, 0.6)";
        }}
        onMouseOut={(e) => {
          e.target.style.transform = "scale(1)";
          e.target.style.boxShadow = "0 8px 24px rgba(102, 126, 234, 0.5)";
        }}
      >
        <Plus size={28} color="white" strokeWidth={3} />
      </button>
    </div>
  );
}
