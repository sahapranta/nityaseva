import { ReactNode } from "react";

export default function AuthShell({ title, subtitle, children }: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="w-full max-w-[380px]">
                {/* Logo */}
                <div className="text-center mb-4">
                    <div className="flex items-center justify-center mx-auto mb-4">
                        <img src="/logo.png" alt="Nityaseva Logo" className="w-32 shadow-2xl rounded-full" />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">নিত্যসেবা বিভাগ</h1>
                    {/* <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Membership Management</p> */}
                </div>

                {/* Card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
                    <div className="px-6 pt-4">
                        <div className="mb-4 text-center">
                            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                            {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
                        </div>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}