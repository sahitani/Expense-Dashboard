import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const { sms } = await req.json()

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
    const amountMatch = sms.match(/Rs\.?\s?(\d+(\.\d+)?)/i)
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0

// ---------- DETERMINE TYPE ----------
let type = "debit" // default

if (/debited/i.test(sms)) {
  type = "debit"
} else if (/credited/i.test(sms)) {
  type = "credit"
}

    // ---------- EXTRACT MERCHANT ----------
    let merchant = "Unknown"
    const merchantMatch = sms.match(/to\s(.+?)\svia/i)
    if (merchantMatch) merchant = merchantMatch[1]

    // ---------- SIMPLE CATEGORY LOGIC ----------
    let category = "Other"

    if (/salary/i.test(sms)) category = "Salary"
    else if (/amazon|flipkart/i.test(sms)) category = "Shopping"
    else if (/uber|ola/i.test(sms)) category = "Transport"
    else if (/hospital|medical/i.test(sms)) category = "Health"
    else if (/rent/i.test(sms)) category = "Rent"
    else if (/upi/i.test(sms)) category = "General Expense"

    // HARD CODE YOUR USER ID HERE
    const USER_ID = "c77cbbd3-7868-456a-bce9-d58b043e8a37"

    const { error } = await supabase.from("transactions").insert({
      user_id: USER_ID,
      amount,
      description: merchant,
      type,
      category,
      date: new Date().toISOString().split("T")[0],
      raw_sms: sms,
      transaction_ref: transactionRef,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
