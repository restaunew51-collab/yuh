"use client";

import { useStudentData } from "@/lib/hooks/use-student-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download } from "lucide-react";

export default function StudentDocumentsPage() {
  const { documents, loading } = useStudentData();

  if (loading) {
    return <div><PageHeader title="Mes documents" /><LoadingState /></div>;
  }

  return (
    <div>
      <PageHeader title="Mes documents" description="Mes documents et certificats" />
      {documents.length === 0 ? (
        <Card className="p-6"><EmptyState title="Aucun document" message="Aucun document n'est disponible pour vous." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.category}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{doc.mime_type ?? "file"}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
