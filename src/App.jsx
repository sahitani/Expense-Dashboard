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

  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}>
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "40px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
        }}>
          <h1 style={{
            fontSize: "24px",
            fontWeight: "600",
            marginBottom: "8px",
            color: "#000"
          }}>
            Expense Tracker
          </h1>
          <p style={{
            color: "#666",
            marginBottom: "32px",
            fontSize: "14px"
          }}>
            Track your finances
          </p>

          <div style={{
            display: "flex",
            marginBottom: "24px",
            borderBottom: "1px solid #e5e5e5"
          }}>
            <button
              onClick={() => setAuthMode("login")}
              style={{
                flex: 1,
                padding: "12px",
                background: "none",
                border: "none",
                borderBottom: authMode === "login" ? "2px solid #000" : "none",
                color: authMode === "login" ? "#000" : "#999",
                fontWeight: "500",
                cursor: "pointer"
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
                borderBottom: authMode === "register" ? "2px solid #000" : "none",
                color: authMode === "register" ? "#000" : "#999",
                fontWeight: "500",
                cursor: "pointer"
              }}
            >
              Register
            </button>
          </div>

          {authError && (
            <div style={{
              padding: "12px",
              marginBottom: "16px",
              background: "#ffebee",
              borderRadius: "6px",
              color: "#c62828",
              fontSize: "14px"
            }}>
              {authError}
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#333",
              fontSize: "14px",
              fontWeight: "500"
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#333",
              fontSize: "14px",
              fontWeight: "500"
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            />
          </div>

          <button
            onClick={authMode === "login" ? login : register}
            style={{
              width: "100%",
              padding: "14px",
              background: "#000",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            {authMode === "login" ? "Login" : "Register"}
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
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px" }}>
        
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <>
            {/* Stats Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
              marginBottom: "24px"
            }}>
              {/* Total Spent */}
              <div style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #e5e5e5"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#666", marginBottom: "8px" }}>Total Spent</p>
                    <p style={{ margin: 0, fontSize: "24px", fontWeight: "600", color: "#000" }}>${totalSpent.toFixed(2)}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#999" }}>This month</p>
                  </div>
                  <TrendingDown size={20} color="#ef4444" />
                </div>
              </div>

              {/* Total Earned */}
              <div style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #e5e5e5"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#666", marginBottom: "8px" }}>Total Earned</p>
                    <p style={{ margin: 0, fontSize: "24px", fontWeight: "600", color: "#000" }}>${totalCredit.toFixed(2)}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#999" }}>This month</p>
                  </div>
                  <TrendingUp size={20} color="#10b981" />
                </div>
              </div>

              {/* Left */}
              <div style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #e5e5e5"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#666", marginBottom: "8px" }}>Left</p>
                    <p style={{ margin: 0, fontSize: "24px", fontWeight: "600", color: "#000" }}>${balanceLeft.toFixed(2)}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#999" }}>Balance left</p>
                  </div>
                  <Calendar size={20} color="#3b82f6" />
                </div>
              </div>

              {/* Daily Burn */}
              <div style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #e5e5e5"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#666", marginBottom: "8px" }}>Daily Burn</p>
                    <p style={{ margin: 0, fontSize: "24px", fontWeight: "600", color: "#000" }}>${dailyBurn.toFixed(2)}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#999" }}>Avg daily</p>
                  </div>
                  <CreditCard size={20} color="#f59e0b" />
                </div>
              </div>
            </div>

            {/* Spending Trend Chart */}
            <div style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              border: "1px solid #e5e5e5",
              marginBottom: "24px"
            }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>Spending Trend</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#999" }}>Last 7 days</p>
              <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "20px" }}>
                <p style={{ color: "#999" }}>Chart placeholder</p>
              </div>
            </div>

            {/* Additional Stats */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px"
            }}>
              <div style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #e5e5e5",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>Active Subscriptions</p>
                  <p style={{ margin: "8px 0 0 0", fontSize: "32px", fontWeight: "600" }}>{subscriptions.length}</p>
                </div>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "#dbeafe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "24px" }}>📱</span>
                </div>
              </div>

              <div style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #e5e5e5",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>Transactions This Month</p>
                  <p style={{ margin: "8px 0 0 0", fontSize: "32px", fontWeight: "600" }}>{currentMonthTransactions.length}</p>
                </div>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "#dcfce7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "24px" }}>📊</span>
                </div>
              </div>

              <div style={{
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                border: "1px solid #e5e5e5",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>Largest Transaction</p>
                  <p style={{ margin: "8px 0 0 0", fontSize: "32px", fontWeight: "600" }}>${largestTransaction.toFixed(2)}</p>
                </div>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "#fce7f3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "24px" }}>📈</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <>
            <div style={{
              background: "#000",
              color: "white",
              padding: "16px 20px",
              borderRadius: "12px 12px 0 0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0"
            }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>All Transactions</h2>
              <button onClick={logout} style={{
                background: "none",
                border: "none",
                color: "white",
                cursor: "pointer",
                fontSize: "14px"
              }}>Logout</button>
            </div>

            {/* Category Filter Chips */}
            <div style={{
              background: "white",
              padding: "16px 20px",
              borderBottom: "1px solid #e5e5e5",
              display: "flex",
              gap: "8px",
              overflowX: "auto"
            }}>
              <button
                onClick={() => setSelectedCategory("all")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: selectedCategory === "all" ? "2px solid #000" : "1px solid #ddd",
                  background: selectedCategory === "all" ? "#f0f0f0" : "white",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                All
              </button>
              {CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    border: selectedCategory === cat ? "2px solid #000" : "1px solid #ddd",
                    background: selectedCategory === cat ? "#f0f0f0" : "white",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Transaction List */}
            <div style={{ background: "white", borderRadius: "0 0 12px 12px" }}>
              {filteredTransactions.slice(0, 10).map((t, index) => (
                <div
                  key={t.id}
                  style={{
                    padding: "16px 20px",
                    borderBottom: index < 9 ? "1px solid #f5f5f5" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "500", color: "#000" }}>
                        {t.description}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", color: "#999" }}>
                        {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      {editingCategoryId === t.id ? (
                        <select
                          value={t.category || 'Other'}
                          onChange={(e) => updateCategoryInline(t.id, e.target.value)}
                          onBlur={() => setEditingCategoryId(null)}
                          autoFocus
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            border: "1px solid #ddd",
                            background: "#f0f0f0"
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
                            padding: "2px 8px",
                            borderRadius: "12px",
                            background: "#f0f0f0",
                            color: "#666",
                            cursor: "pointer"
                          }}
                        >
                          {t.category || t.type}
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: "600",
                    color: t.type === "debit" ? "#ef4444" : "#10b981"
                  }}>
                    {t.type === "debit" ? "-" : "+"}${t.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Subscriptions Tab */}
        {activeTab === "subscriptions" && (
          <>
            <div style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              color: "white",
              padding: "24px",
              borderRadius: "12px",
              marginBottom: "24px"
            }}>
              <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Active Subscriptions</p>
              <p style={{ margin: "8px 0", fontSize: "32px", fontWeight: "700" }}>{subscriptions.length}</p>
              <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Monthly Spend</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "600" }}>
                ${subscriptions.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}
              </p>
              <p style={{ margin: "12px 0 0 0", fontSize: "14px", opacity: 0.9 }}>Annual Projection</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "600" }}>
                ${(subscriptions.reduce((sum, s) => sum + s.amount, 0) * 12).toFixed(2)}
              </p>
            </div>

            {subscriptions.length === 0 ? (
              <div style={{
                background: "white",
                borderRadius: "12px",
                padding: "48px",
                textAlign: "center",
                border: "1px solid #e5e5e5"
              }}>
                <p style={{ margin: 0, color: "#999" }}>No subscriptions detected yet.</p>
              </div>
            ) : (
              subscriptions.map((sub) => {
                const nextBilling = new Date(sub.next_billing_date);
                const today = new Date();
                const daysUntil = Math.ceil((nextBilling - today) / (1000 * 60 * 60 * 24));

                return (
                  <div
                    key={sub.id}
                    style={{
                      background: "white",
                      borderRadius: "12px",
                      padding: "20px",
                      marginBottom: "16px",
                      border: "1px solid #e5e5e5"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#000" }}>
                          {sub.merchant}
                        </h4>
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#666" }}>
                          {sub.billing_cycle === 'monthly' ? 'Monthly' : sub.billing_cycle}
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#000" }}>
                        ${sub.amount.toFixed(2)}
                      </p>
                    </div>

                    <div style={{
                      background: "#fef3c7",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      marginBottom: "12px"
                    }}>
                      <p style={{ margin: 0, fontSize: "12px", color: "#92400e" }}>
                        {daysUntil} days until billing
                      </p>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                        Next Billing: {nextBilling.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <button style={{
                        padding: "6px 12px",
                        background: "none",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        Manage Subscription →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
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
    </div>
  );
}
