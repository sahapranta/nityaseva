import { useState } from "react";
import { useAuth } from "../Auth";
import Icon from "./Icon";

export function LogoutButton() {
    const { user, logout } = useAuth();
    const [confirm, setConfirm] = useState(false);

    return (
        <>
            {/* Profile & Logout Section */}
            <div className="pt-2 pb-0">
                <div className="flex items-center gap-2 py-1.5 rounded-md bg-white/5">
                    <Icon d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z" size={24} />
                    <div className="flex-1 min-w-0">
                        <div className="text-md font-medium truncate text-slate-900">
                            {user?.name}
                        </div>
                        <div className="text-xs text-slate-500 capitalize">
                            {user?.role.replace("_", " ")}
                        </div>
                    </div>
                    <button
                        className="flex-shrink-0 p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-colors"
                        title="Logout"
                        onClick={() => setConfirm(true)}
                    >
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirm && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    onClick={() => setConfirm(false)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-xl w-full min-w-[300px] max-w-[360px] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-8 text-center">
                            <p className="text-xl font-medium text-slate-800">
                                Log out of Nityaseva?
                            </p>
                        </div>
                        
                        <div className="flex border-t border-slate-100">
                            <button 
                                className="flex-1 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors border-r border-slate-100" 
                                onClick={() => setConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="flex-1 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors" 
                                onClick={logout}
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}