import { useEffect } from "react";
import { useQuill } from "react-quilljs";

import "quill/dist/quill.snow.css";

interface IQuillEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function QuillEditor({ value, onChange }: IQuillEditorProps) {
  const { quill, quillRef } = useQuill();

  useEffect(() => {
    if (quill) {
      quill.clipboard.dangerouslyPasteHTML(value);
    }
  }, [quill]);

  useEffect(() => {
    if (quill) {
      quill.on("text-change", (delta, oldDelta, source) => {
        /*
        console.log(quill.getText());
        console.log(quill.getContents());
        console.log(quill.root.innerHTML);
        console.log(quillRef.current.firstChild.innerHTML);
         */
        onChange(quill.root.innerHTML);
      });
    }
  }, [quill]);

  return (
    <div className="h-64">
      <div ref={quillRef} />
    </div>
  );
}
