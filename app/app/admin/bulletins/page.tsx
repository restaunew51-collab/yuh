"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Printer, FileText, Award } from "lucide-react";

type Grade = Database["public"]["Tables"]["grades"]["Row"];
type Assessment = Database["public"]["Tables"]["assessments"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];

type AssessmentWithSubject = Assessment & {
  subjects?: { name: string; code: string; coefficient: number };
};

type EnrollmentWithStudent = Enrollment & {
  students?: { student_number: string; profile_id: string | null };
};

interface SubjectAverage {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  coefficient: number;
  average: number;
  assessmentCount: number;
}

interface StudentBulletin {
  enrollment: EnrollmentWithStudent;
  subjectAverages: SubjectAverage[];
  generalAverage: number;
  totalCoefficients: number;
  rank: number;
  totalStudents: number;
}

export default function BulletinsPage() {
  const { permissions, profile } = useAuth();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string; academic_year_id: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("all");
  const [bulletins, setBulletins] = useState<StudentBulletin[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasComputed, setHasComputed] = useState(false);
  const [selectedBulletin, setSelectedBulletin] = useState<StudentBulletin | null>(null);

  const canView = permissions.includes("grades.view" as never) || permissions.includes("grades.validate" as never);

  useEffect(() => {
    if (profile?.institution_id) {
      supabase.from("classes").select("id, name").eq("institution_id", profile.institution_id).order("name")
        .then(({ data }) => setClasses(data ?? []));
      supabase.from("academic_years").select("id, name").eq("institution_id", profile.institution_id).order("start_date", { ascending: false })
        .then(({ data }) => setAcademicYears(data ?? []));
    }
  }, [profile?.institution_id]);

  useEffect(() => {
    if (selectedYear) {
      supabase.from("terms").select("id, name, academic_year_id").eq("academic_year_id", selectedYear).order("start_date")
        .then(({ data }) => setTerms(data ?? []));
    } else {
      setTerms([]);
    }
    setSelectedTerm("all");
  }, [selectedYear]);

  const computeBulletins = useCallback(async () => {
    if (!selectedClass || !selectedYear) return;
    setLoading(true);
    setHasComputed(true);
    try {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("*, students(student_number, profile_id)")
        .eq("class_id", selectedClass)
        .eq("academic_year_id", selectedYear)
        .eq("status", "active")
        .order("enrollment_date");

      if (!enrollments || enrollments.length === 0) {
        setBulletins([]);
        return;
      }

      const { data: assessments } = await supabase
        .from("assessments")
        .select("*, subjects(name, code, coefficient)")
        .eq("class_id", selectedClass)
        .eq("academic_year_id", selectedYear)
        .in("status", ["published", "validated"]);

      if (!assessments || assessments.length === 0) {
        setBulletins([]);
        return;
      }

      let termStart: string | null = null;
      let termEnd: string | null = null;
      if (selectedTerm !== "all") {
        const term = terms.find((t) => t.id === selectedTerm);
        if (term) {
          const { data: termData } = await supabase
            .from("terms")
            .select("start_date, end_date")
            .eq("id", selectedTerm)
            .maybeSingle();
          termStart = termData?.start_date ?? null;
          termEnd = termData?.end_date ?? null;
        }
      }

      const filteredAssessments = assessments.filter((a) => {
        if (!termStart || !termEnd) return true;
        return a.date >= termStart && a.date <= termEnd;
      });

      const assessmentIds = filteredAssessments.map((a) => a.id);
      if (assessmentIds.length === 0) {
        setBulletins([]);
        return;
      }

      const { data: allGrades } = await supabase
        .from("grades")
        .select("*")
        .in("assessment_id", assessmentIds)
        .in("status", ["submitted", "validated"]);

      const gradesByAssessment: Record<string, Grade[]> = {};
      for (const g of allGrades ?? []) {
        if (!gradesByAssessment[g.assessment_id]) gradesByAssessment[g.assessment_id] = [];
        gradesByAssessment[g.assessment_id].push(g);
      }

      const results: StudentBulletin[] = enrollments.map((enr) => {
        const subjectMap: Record<string, { weightedSum: number; totalCoef: number; count: number; subjectName: string; subjectCode: string; coefficient: number }> = {};

        for (const a of filteredAssessments) {
          const gradesForAssessment = (gradesByAssessment[a.id] ?? []).filter((g) => g.student_id === enr.student_id);
          if (gradesForAssessment.length === 0) continue;
          const grade = gradesForAssessment[0];
          const normalizedScore = (grade.score / a.max_score) * 20;
          const subjId = a.subject_id;
          if (!subjectMap[subjId]) {
            subjectMap[subjId] = {
              weightedSum: 0, totalCoef: 0, count: 0,
              subjectName: (a as AssessmentWithSubject).subjects?.name ?? "—",
              subjectCode: (a as AssessmentWithSubject).subjects?.code ?? "",
              coefficient: (a as AssessmentWithSubject).subjects?.coefficient ?? 1,
            };
          }
          subjectMap[subjId].weightedSum += normalizedScore * a.coefficient;
          subjectMap[subjId].totalCoef += a.coefficient;
          subjectMap[subjId].count += 1;
        }

        const subjectAverages: SubjectAverage[] = Object.entries(subjectMap).map(([subjectId, data]) => ({
          subjectId,
          subjectName: data.subjectName,
          subjectCode: data.subjectCode,
          coefficient: data.coefficient,
          average: data.totalCoef > 0 ? data.weightedSum / data.totalCoef : 0,
          assessmentCount: data.count,
        }));

        const totalCoefficients = subjectAverages.reduce((sum, s) => sum + s.coefficient, 0);
        const weightedSum = subjectAverages.reduce((sum, s) => sum + s.average * s.coefficient, 0);
        const generalAverage = totalCoefficients > 0 ? weightedSum / totalCoefficients : 0;

        return {
          enrollment: enr as EnrollmentWithStudent,
          subjectAverages,
          generalAverage,
          totalCoefficients,
          rank: 0,
          totalStudents: enrollments.length,
        };
      });

      results.sort((a, b) => b.generalAverage - a.generalAverage);
      results.forEach((r, idx) => { r.rank = idx + 1; });

      setBulletins(results);
    } catch {
      setBulletins([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedYear, selectedTerm, terms]);

  useEffect(() => {
    if (selectedClass && selectedYear) {
      computeBulletins();
    } else {
      setBulletins([]);
      setHasComputed(false);
    }
  }, [computeBulletins, selectedClass, selectedYear]);

  if (!canView) {
    return <div><PageHeader title="Bulletins" /><Card className="p-6"><EmptyState title="Acces refuse" message="Vous n'avez pas la permission d'acceder a cette section." /></Card></div>;
  }

  if (selectedBulletin) {
    return <BulletinPrintView bulletin={selectedBulletin} onBack={() => setSelectedBulletin(null)} academicYearName={academicYears.find((y) => y.id === selectedYear)?.name ?? ""} termName={selectedTerm !== "all" ? terms.find((t) => t.id === selectedTerm)?.name ?? "" : "Annuelle"} />;
  }

  return (
    <div>
      <PageHeader title="Bulletins" description="Calcul des moyennes et classement" />

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Selectionner une classe" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Annee academique" /></SelectTrigger>
            <SelectContent>
              {academicYears.map((ay) => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTerm} onValueChange={setSelectedTerm} disabled={!selectedYear}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Toutes les periodes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Annuelle</SelectItem>
              {terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {!selectedClass || !selectedYear ? (
        <Card className="p-4">
          <EmptyState title="Selectionnez une classe et une annee" message="Choisissez une classe et une annee academique pour calculer les bulletins." />
        </Card>
      ) : loading ? (
        <LoadingState message="Calcul des moyennes..." />
      ) : bulletins.length === 0 ? (
        <Card className="p-4">
          <EmptyState title="Aucun bulletin" message="Aucune note publiee ou validee pour ces criteres. Publiez des evaluations et saisissez des notes d'abord." />
        </Card>
      ) : (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rang</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Moyenne /20</TableHead>
                  <TableHead>Moyenne /10</TableHead>
                  <TableHead>Mention</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulletins.map((b) => (
                  <TableRow key={b.enrollment.id}>
                    <TableCell>
                      <Badge variant={b.rank === 1 ? "default" : "outline"}>{b.rank}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{b.enrollment.students?.student_number ?? "-"}</TableCell>
                    <TableCell className="font-bold">{b.generalAverage.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">{(b.generalAverage / 2).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        b.generalAverage >= 16 ? "default" :
                        b.generalAverage >= 14 ? "secondary" :
                        b.generalAverage >= 12 ? "secondary" :
                        b.generalAverage >= 10 ? "outline" : "destructive"
                      }>
                        {b.generalAverage >= 16 ? "Tres Bien" :
                         b.generalAverage >= 14 ? "Bien" :
                         b.generalAverage >= 12 ? "Assez Bien" :
                         b.generalAverage >= 10 ? "Passable" : "Insuffisant"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedBulletin(b)}>
                        <FileText className="w-4 h-4 mr-1" /> Bulletin
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function getMention(avg: number): string {
  if (avg >= 16) return "Tres Bien";
  if (avg >= 14) return "Bien";
  if (avg >= 12) return "Assez Bien";
  if (avg >= 10) return "Passable";
  return "Insuffisant";
}

function BulletinPrintView({
  bulletin, onBack, academicYearName, termName,
}: {
  bulletin: StudentBulletin;
  onBack: () => void;
  academicYearName: string;
  termName: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4 no-print">
        <Button variant="outline" size="sm" onClick={onBack}>Retour</Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Imprimer / PDF
        </Button>
      </div>

      <Card className="p-6 sm:p-8 max-w-3xl mx-auto print:shadow-none print:border-0">
        <div className="text-center mb-6 border-b pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Award className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">BULLETIN DE NOTES</h1>
          </div>
          <p className="text-sm text-muted-foreground">{academicYearName} - {termName}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Matricule</p>
            <p className="font-medium">{bulletin.enrollment.students?.student_number ?? "-"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Rang</p>
            <p className="font-medium">{bulletin.rank} / {bulletin.totalStudents}</p>
          </div>
        </div>

        <div className="overflow-x-auto mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matiere</TableHead>
                <TableHead className="text-center">Coef.</TableHead>
                <TableHead className="text-center">Moyenne /20</TableHead>
                <TableHead className="text-center">Note /10</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bulletin.subjectAverages.map((s) => (
                <TableRow key={s.subjectId}>
                  <TableCell className="font-medium">{s.subjectName} <span className="text-xs text-muted-foreground">({s.subjectCode})</span></TableCell>
                  <TableCell className="text-center">{s.coefficient}</TableCell>
                  <TableCell className="text-center font-medium">{s.average.toFixed(2)}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{(s.average / 2).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
            <span className="text-sm font-medium">Moyenne generale</span>
            <span className="text-lg font-bold">{bulletin.generalAverage.toFixed(2)} / 20</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
            <span className="text-sm font-medium">Moyenne /10</span>
            <span className="text-lg font-bold">{(bulletin.generalAverage / 2).toFixed(2)} / 10</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10">
            <span className="text-sm font-medium">Mention</span>
            <Badge variant="default" className="text-sm">{getMention(bulletin.generalAverage)}</Badge>
          </div>
          <div className="flex justify-between items-center p-3">
            <span className="text-sm font-medium">Classement</span>
            <span className="text-sm font-bold">{bulletin.rank}er sur {bulletin.totalStudents}</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Le formateur</p>
            <div className="border-t pt-1 mt-8">Signature</div>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">La direction</p>
            <div className="border-t pt-1 mt-8">Cachet et signature</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
