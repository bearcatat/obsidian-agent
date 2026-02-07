import { FuzzySuggestModal, TFile } from "obsidian";
import { App } from "obsidian";

export class AddContextNoteModel extends FuzzySuggestModal<TFile> {
    private activeNote: TFile | null;
    private addNoteToContext: (note: TFile) => void;

    constructor(app: App, addNoteToContext: (note: TFile) => void) {
        super(app);
        this.activeNote = app.workspace.getActiveFile();
        this.addNoteToContext = addNoteToContext;
    }

    getItems(): TFile[] {
        const files = this.app.vault.getFiles();

        const notes = files.filter((file) => {
            return file.extension === "md" && file.basename !== this.activeNote?.basename;
        });

        if (this.activeNote) {
            notes.unshift(this.activeNote);
        }
        return notes;
    }

    getItemText(item: TFile): string {
        if (item.basename === this.activeNote?.basename) {
            return `${item.basename}(current)`;
        }
        return item.basename;
    }

    onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        // const { addContextNote } = useAgentLogic();
        // const isActive = this.app.workspace.getActiveFile()?.path === item.path;
        // addContextNote(item, isActive);
        this.addNoteToContext(item)
    }
}