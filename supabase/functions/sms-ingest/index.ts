import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const { sms, user_id } = await req.json()
	if (!user_id) {
  return new Response(
    JSON.stringify({ error: "user_id missing" }),
    { status: 400 }
  )
}

    if (!sms) {
      return new Response(JSON.stringify({ error: "No SMS provided" }), { status: 400 })
    }

    // ---------- CONNECT TO SUPABASE ----------
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // ---------- EXTRACT TRANSACTION REFERENCE ----------
    const refMatch = sms.match(/(?:Ref|UPI|Txn|UTR)[^\d]*(\d{10,16})/i)
    const transactionRef = refMatch ? refMatch[1] : null

    // ---------- CHECK FOR DUPLICATE TRANSACTION ----------
    if (transactionRef) {
      // Check duplicate using transaction_ref
      const { data: existing } = await supabase
        .from("transactions")
        .select("uuid")
        .eq("transaction_ref", transactionRef)
        .limit(1)

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ message: "Duplicate transaction ignored" }),
          { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      }
    } else {
      // Fallback: Check duplicate using raw_sms
      const { data: existingSms } = await supabase
        .from("transactions")
        .select("uuid")
        .eq("raw_sms", sms)
        .limit(1)

      if (existingSms && existingSms.length > 0) {
        return new Response(
          JSON.stringify({ message: "Duplicate transaction ignored" }),
          { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      }
    }

// ---------- PARSE AMOUNT ----------
let amount = 0

const amountPatterns = [
  /Rs\.?\s?(\d+(\.\d+)?)/i,
  /INR\s?(\d+(\.\d+)?)/i,
  /debited\s*(?:by|for)?\s*(\d+(\.\d+)?)/i,
  /credited\s*(?:by|for)?\s*(\d+(\.\d+)?)/i
]

for (const pattern of amountPatterns) {
  const match = sms.match(pattern)
  if (match) {
    amount = parseFloat(match[1])
    break
  }
}

// ---------- DETERMINE TYPE ----------
let type = "debit" // default

if (/debited/i.test(sms)) {
  type = "debit"
} else if (/credited/i.test(sms)) {
  type = "credit"
}

// ---------- MERCHANT EXTRACTION ----------
let merchant = "unknown"

// normalize SMS
const normalizedSms = sms.replace(/\s+/g, " ").trim()

const patterns = [
  /([A-Za-z0-9\s&@.-]+?)\s+credited/i,                // Blinkit credited
  /credited to ([A-Za-z0-9\s&@.-]+)/i,
  /paid to ([A-Za-z0-9\s&@.-]+)/i,
  /debited at ([A-Za-z0-9\s&@.-]+)/i,
  /(?:trf|transfer|sent)\s+to\s+([A-Za-z0-9\s&@.-]+)/i,
  /towards ([A-Za-z0-9\s&@.-]+)/i,
  /to ([A-Za-z0-9\s&@.-]+?) via UPI/i,
  /to ([A-Za-z0-9\s&@.-]+?) UPI/i,
  /UPI\s*[-:]?\s*([A-Za-z0-9\s&@.-]+)/i,
  /from ([A-Za-z0-9\s&@.-]+)/i,
]

for (const pattern of patterns) {
  const match = normalizedSms.match(pattern)
  if (match && match[1]) {
    merchant = match[1].trim()
    break
  }
}

// ---------- CLEAN MERCHANT STRING ----------
if (merchant !== "unknown") {
  merchant = merchant
    .replace(/via UPI.*/i, "")
    .replace(/UPI.*/i, "")
    .replace(/Ref.*/i, "")
    .replace(/Txn.*/i, "")
    .replace(/AutoPay.*/i, "")
    .replace(/Retrieval.*/i, "")
    .replace(/IMPS.*/i, "")
    .replace(/NEFT.*/i, "")
    .replace(/A\/C.*/i, "")
    .replace(/on \d{1,2}-[A-Za-z]{3}-\d{2}.*/i, "")
    .trim()

  // convert to title case
  merchant = merchant.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ---------- FINAL SAFETY ----------
if (!merchant || merchant.length > 60) {
  merchant = "unknown"
}

// ---------- CLEAN MERCHANT STRING ----------
if (merchant !== "unknown") {
  merchant = merchant
    .replace(/via UPI.*/i, "")
    .replace(/UPI.*/i, "")
    .replace(/Ref.*/i, "")
    .replace(/Txn.*/i, "")
    .replace(/AutoPay.*/i, "")
    .replace(/Retrieval.*/i, "")
    .replace(/IMPS.*/i, "")
    .replace(/NEFT.*/i, "")
    .replace(/on \d{1,2}-[A-Za-z]{3}-\d{2}.*/i, "")
    .trim()
	// Convert to Title Case
	merchant = merchant.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ---------- FINAL SAFETY ----------
if (!merchant || merchant.length > 60) {
  merchant = "unknown"
}


    // ---------- CHECK USER MERCHANT RULES ----------
    let category = null
    const { data: merchantRule } = await supabase
      .from("user_merchant_rules")
      .select("category")
      .eq("user_id", user_id)
      .eq("merchant", merchant)
      .limit(1)

    if (merchantRule && merchantRule.length > 0) {
      category = merchantRule[0].category
    }

    // ---------- FALLBACK TO SIMPLE CATEGORY LOGIC ----------
    if (!category) {
      category = "Other"

      if (/salary/i.test(sms)) category = "Salary"
      else if (/amazon|flipkart/i.test(sms)) category = "Shopping"
      else if (/uber|ola/i.test(sms)) category = "Transport"
      else if (/hospital|medical/i.test(sms)) category = "Health"
      else if (/rent/i.test(sms)) category = "Rent"
      else if (/upi/i.test(sms)) category = "General Expense"
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user_id,
      amount,
      description: merchant,
      type,
      category,
      date: new Date().toISOString().split("T")[0],
      raw_sms: sms,
      transaction_ref: transactionRef,
    })

// ---------- SAVE / LEARN MERCHANT RULE ----------
await supabase
  .from("user_merchant_rules")
  .upsert({
    user_id: user_id,
    merchant: merchant,
    category: category
  }, {
    onConflict: "user_id,merchant"
  })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    // ---------- SUBSCRIPTION DETECTION ----------
    let isSubscription = false

    // Condition 1: Keyword Detection
    const subscriptionKeywords = /autopay|subscription|renewal|membership|recurring/i
    if (subscriptionKeywords.test(sms)) {
      isSubscription = true
    }

    // Condition 2: Recurring Detection (same merchant + amount in 25-35 days)
    if (!isSubscription && merchant !== "unknown" && amount > 0) {
      const thirtyFiveDaysAgo = new Date()
      thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35)

      const { data: similarTransactions } = await supabase
        .from("transactions")
        .select("date")
        .eq("user_id", user_id)
        .eq("description", merchant)
        .eq("amount", amount)
        .gte("date", thirtyFiveDaysAgo.toISOString().split("T")[0])
        .order("date", { ascending: false })

      if (similarTransactions && similarTransactions.length >= 2) {
        // Check if any two transactions are 25-35 days apart
        for (let i = 0; i < similarTransactions.length - 1; i++) {
          for (let j = i + 1; j < similarTransactions.length; j++) {
            const date1 = new Date(similarTransactions[i].date)
            const date2 = new Date(similarTransactions[j].date)
            const daysDiff = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
            
            if (daysDiff >= 25 && daysDiff <= 35) {
              isSubscription = true
              break
            }
          }
          if (isSubscription) break
        }
      }
    }

    // If subscription detected, create or update subscription record
    if (isSubscription) {
      const currentDate = new Date()
      const nextBillingDate = new Date(currentDate)
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

      await supabase
        .from("subscriptions")
        .upsert({
          user_id: user_id,
          merchant: merchant,
          amount: amount,
          billing_cycle: "monthly",
          next_billing_date: nextBillingDate.toISOString().split("T")[0],
          status: "active"
        }, {
          onConflict: "user_id,merchant,amount"
        })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
