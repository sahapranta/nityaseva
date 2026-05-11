import { useLang } from "../contexts/LangContext";

interface ConfirmDialogProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog(
    { message, onConfirm, onCancel }: ConfirmDialogProps
) {
    const { tr } = useLang();
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" style={{ minWidth: 320, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                <div className="modal-body text-center px-5 py-6">
                    <p className="text-xl">{message}</p>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onCancel}>{tr("cancel")}</button>
                    <button className="btn btn-danger" onClick={onConfirm}>{tr("delete")}</button>
                </div>
            </div>
        </div>
    );
}