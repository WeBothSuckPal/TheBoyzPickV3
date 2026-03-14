import {
  Card,
  CardContent,
} from "@/components/ui/card";

const faq = [
  {
    q: "What sports are available?",
    a: "NFL and NCAAF football. We sync odds regularly from major sportsbooks.",
  },
  {
    q: "How much does it cost?",
    a: "$50 real-money buy-in per season. You get $150 in betting credits to start.",
  },
  {
    q: "How do parlays work?",
    a: "Build slips with 1 to 10 picks. All legs must hit for the parlay to pay out. Odds multiply.",
  },
  {
    q: "Who runs this?",
    a: "A commissioner manages the club \u2014 approving members, settling disputes, and keeping things fair.",
  },
  {
    q: "How do I win?",
    a: "The member with the highest credit balance at the end of the season wins the pot.",
  },
  {
    q: "Is this legal?",
    a: "This is a private social club among friends. No real-money wagering happens through the app \u2014 credits are tracked internally.",
  },
];

export default function FaqPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white">
          FAQ
        </h2>
        <p className="mt-1 text-[var(--muted-foreground)]">
          Everything you need to know about the club.
        </p>
      </div>
      <Card className="overflow-hidden">
        <CardContent className="divide-y divide-white/10 p-0">
          {faq.map((item, i) => (
            <div key={i} className="px-6 py-5">
              <h3 className="font-semibold text-white">{item.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {item.a}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
