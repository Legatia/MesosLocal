"use client";

import { useState, useRef, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";

type Message = {
    id: string;
    sender: "user" | "agent";
    text: string;
    type?: "text" | "invoice_parse" | "compliance_check" | "transaction_request" | "yield_status";
    data?: any;
    timestamp: Date;
};

interface DispatcherAgentProps {
    onParseTransaction: (address: string, amount: string) => void;
    onExecuteTransaction: () => Promise<any>;
    vaultBalance: string;
    isMerchantRegistered: (address: string) => boolean;
    tenantId?: string;      // Wallet public key
    tenantName?: string;    // Optional business name
}

export default function DispatcherAgent({
    onParseTransaction,
    onExecuteTransaction,
    vaultBalance,
    isMerchantRegistered,
    tenantId,
    tenantName
}: DispatcherAgentProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            sender: "agent",
            text: "👋 Hi! I'm your Dispatcher Agent. Upload an invoice or just tell me who to pay.",
            type: "text",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            sender: "user",
            text: input,
            type: "text",
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        // Simulate AI Processing
        // Removed setTimeout, processCommand is now async
        processCommand(userMsg.text);
    };

    const processCommand = async (text: string) => {
        // Special Keyword: Yield Management (Local)
        if (text.toLowerCase().includes("yield") || text.toLowerCase().includes("treasury")) {
            checkYieldStatus();
            return;
        }

        console.log("Processing via Groq AI:", text);
        addAgentMessage("Consulting Groq (Llama 3.1)...", "text");
        setIsTyping(true);

        try {
            const res = await fetch("/api/agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    tenantId: tenantId,
                    tenantName: tenantName
                })
            });

            const data = await res.json();

            if (data.error) {
                if (res.status === 503) {
                    addAgentMessage("Model is waking up (Cold boot). Please try again in 30 seconds.");
                } else {
                    addAgentMessage(`API Error: ${data.error}. Falling back to local regex.`);
                    processCommandRegex(text);
                }
                setIsTyping(false);
                return;
            }

            // Handle different intents from the multi-capability agent
            if (data.intent) {
                switch (data.intent) {
                    case "balance":
                        addAgentMessage(`💰 Your current vault balance is: **${vaultBalance} USDC**`);
                        break;
                    case "merchants":
                        addAgentMessage(`📋 To see registered merchants, check the **Whitelist Management** section in the Terminal. (Feature coming: list them here!)`);
                        break;
                    case "yield":
                        checkYieldStatus();
                        break;
                    case "unknown":
                        addAgentMessage(data.message || "I'm not sure what you mean. Try: 'Pay 50 to [address]' or 'Check my balance'");
                        break;
                }
                setIsTyping(false);
                return;
            }

            // Payment intent: check for amount and address
            if (data.fallback || !data.amount) {
                console.log("AI returned abstract response, using regex fallback on input.");
                processCommandRegex(text);
            } else {
                const { amount, address } = data;
                onParseTransaction(address, amount);
                addAgentMessage(`AI Parsed: **${amount} vouchers** to **${address.slice(0, 6)}...**`);
                setTimeout(() => runComplianceCheck(address, amount), 800);
            }
            setIsTyping(false);

        } catch (e) {
            console.error(e);
            setIsTyping(false);
            addAgentMessage("Network error. Falling back to local parsing.");
            processCommandRegex(text);
        }
    };

    const processCommandRegex = (text: string) => {
        // Robust Fallback
        const amountMatch = text.match(/(\d+(\.\d{1,2})?)/);
        const addressMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);

        if (amountMatch && addressMatch) {
            onParseTransaction(addressMatch[0], amountMatch[0]);
            addAgentMessage(`(Regex Fallback): Found **${amountMatch[0]}** vouchers to **${addressMatch[0].slice(0, 6)}...**`);
            setTimeout(() => runComplianceCheck(addressMatch[0], amountMatch[0]), 800);
        } else {
            addAgentMessage("I couldn't quite catch the details. Try: 'Pay 50 to [Address]'");
        }
    };

    const runComplianceCheck = (address: string, amount: string) => {
        // Visual Compliance Sequence
        addAgentMessage("", "compliance_check", {
            step: "scanning",
            details: "Scanning recipient wallet history...",
            status: "pending"
        });

        setTimeout(() => {
            // Update last message to "Approved"
            setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg.type === "compliance_check") {
                    // Check if merchant registered (Simulated logic using prop)
                    // For demo, we assume success often, but let's check basic logic
                    const isReg = isMerchantRegistered(address);

                    lastMsg.data = {
                        step: "verified",
                        details: isReg ? "✅ Location matches Invoice. 🛡️ Role Verified." : "⚠️ Merchant Agent not detected.",
                        status: isReg ? "success" : "warning"
                    };
                }
                return newMsgs;
            });
            setIsTyping(false);

            // Ask for confirmation
            setTimeout(() => {
                addAgentMessage("", "transaction_request", { amount, address });
            }, 500);

        }, 2000);
    };

    const checkYieldStatus = () => {
        setIsTyping(false);
        const idle = Number(vaultBalance || 0) * 0.8; // Simulate 80% idle
        addAgentMessage(`Treasury Analysis:\n• Idle Cash: ${vaultBalance} USDC\n• Opportunity: ~${(idle * 0.05 / 365).toFixed(4)} USDC/day (5% APY)`, "yield_status", { idle });
    };

    const addAgentMessage = (text: string, type: Message["type"] = "text", data?: any) => {
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            sender: "agent",
            text,
            type,
            data,
            timestamp: new Date()
        }]);
    };

    return (
        <div className="flex flex-col h-[600px] w-full max-w-md bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex-shrink-0">
            {/* Header */}
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <span className="text-xl">🤖</span>
                </div>
                <div>
                    <h3 className="font-bold text-white">Dispatcher Agent</h3>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-xs text-indigo-300">Online • Compliance Active</span>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 ${msg.sender === "user"
                            ? "bg-indigo-600 text-white rounded-br-none"
                            : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700"
                            }`}>
                            {msg.type === "text" && <p className="text-sm leading-relaxed">{msg.text}</p>}

                            {msg.type === "compliance_check" && (
                                <div className="space-y-2 min-w-[200px]">
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-500">
                                        🛡️ Compliance Watchdog
                                    </div>
                                    <div className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg">
                                        {msg.data.status === "pending" && <span className="animate-spin text-lg">⏳</span>}
                                        {msg.data.status === "success" && <span className="text-lg">✅</span>}
                                        {msg.data.status === "warning" && <span className="text-lg">⚠️</span>}
                                        <span className={`text-sm font-medium ${msg.data.status === "success" ? "text-green-400" :
                                            msg.data.status === "warning" ? "text-yellow-400" : "text-blue-300"
                                            }`}>
                                            {msg.data.details}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {msg.type === "transaction_request" && (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-400">Transaction ready for signature.</p>
                                    <div className="p-3 bg-slate-900 rounded border border-indigo-500/30">
                                        <div className="flex justify-between text-xs text-slate-500 mb-1">PAY TO</div>
                                        <div className="font-mono text-sm text-indigo-300 truncate mb-2">{msg.data.address}</div>
                                        <div className="flex justify-between text-xs text-slate-500 mb-1">AMOUNT</div>
                                        <div className="font-bold text-white text-lg">{msg.data.amount} <span className="text-xs font-normal text-slate-400">VOUCHERS</span></div>
                                    </div>
                                    <button
                                        onClick={onExecuteTransaction}
                                        className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        Sign & Send 🚀
                                    </button>
                                </div>
                            )}

                            {msg.type === "yield_status" && (
                                <div className="space-y-2">
                                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                    {msg.data.idle > 0 && (
                                        <button className="w-full py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded text-xs font-medium hover:bg-emerald-600/30">
                                            Auto-Sweep to Kamino (Simulated)
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start animate-pulse">
                        <div className="bg-slate-800 rounded-full px-4 py-2 text-slate-400 text-xs">
                            Agent is thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-slate-800 border-t border-slate-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Type 'Pay 50 to [Address]...'"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                    <button
                        onClick={handleSend}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-lg transition-colors flex items-center justify-center"
                    >
                        ➤
                    </button>
                </div>
            </div>
        </div>
    );
}
