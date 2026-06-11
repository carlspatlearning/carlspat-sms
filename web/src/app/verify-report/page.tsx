"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, ShieldX } from "lucide-react";
import { api, ApiResponse } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

interface Verification {
  valid: boolean;
  student?: string;
  admissionNo?: string;
  className?: string;
  term?: string;
}

function VerifyContent() {
  const params = useSearchParams();
  const [result, setResult] = useState<Verification | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const sid = params.get("sid");
    const tid = params.get("tid");
    const sig = params.get("sig");
    if (!sid || !tid || !sig) {
      setError(true);
      return;
    }
    api
      .get<ApiResponse<Verification>>(`/report-cards/verify?sid=${sid}&tid=${tid}&sig=${sig}`)
      .then((r) => setResult(r.data))
      .catch(() => setError(true));
  }, [params]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center p-8 text-center">
          {!result && !error && <p className="text-muted-foreground">Verifying report card…</p>}
          {(error || result?.valid === false) && (
            <>
              <ShieldX className="h-14 w-14 text-destructive" />
              <h1 className="mt-3 text-xl font-bold">Verification Failed</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                This report card could not be verified. It may have been altered or the link is invalid.
                Please contact Carlspat Private School on 08067281676.
              </p>
            </>
          )}
          {result?.valid && (
            <>
              <BadgeCheck className="h-14 w-14 text-green-600" />
              <h1 className="mt-3 text-xl font-bold">Authentic Report Card</h1>
              <p className="mt-1 text-sm text-muted-foreground">Issued by Carlspat Private School, Ido Ekiti.</p>
              <dl className="mt-4 w-full space-y-2 text-left text-sm">
                <div className="flex justify-between border-b pb-1"><dt className="text-muted-foreground">Student</dt><dd className="font-medium">{result.student}</dd></div>
                <div className="flex justify-between border-b pb-1"><dt className="text-muted-foreground">Admission No</dt><dd className="font-mono">{result.admissionNo}</dd></div>
                <div className="flex justify-between border-b pb-1"><dt className="text-muted-foreground">Class</dt><dd>{result.className}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Term</dt><dd>{result.term}</dd></div>
              </dl>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function VerifyReportPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
