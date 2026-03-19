import type { Metadata } from "next";

import { appName } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: `Legal | ${appName}`,
};

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Anchor nav */}
      <div className="flex gap-6 border-b border-white/10 pb-4 text-sm">
        <a
          href="#terms"
          className="font-semibold text-[var(--accent)] transition hover:text-white"
        >
          Terms of Use
        </a>
        <a
          href="#privacy"
          className="font-semibold text-[var(--accent)] transition hover:text-white"
        >
          Privacy Policy
        </a>
      </div>

      {/* Terms of Use */}
      <section id="terms">
        <Card>
          <CardHeader>
            <CardTitle>Terms of Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-7 text-[var(--muted-foreground)]">
            <p>
              {appName} is a private, invite-only sports picks competition platform. By accessing
              this platform you agree to the following terms.
            </p>

            <div>
              <h3 className="mb-1 font-semibold text-white">Private Club</h3>
              <p>
                Access is restricted to invited members only. The commissioner reserves the right
                to suspend or remove any member at their sole discretion. Membership is not
                transferable.
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-semibold text-white">Club Credits &amp; Payouts</h3>
              <p>
                All balances (&ldquo;club credits&rdquo;) are for entertainment and competition
                purposes only. They carry no real-world monetary value except where the
                commissioner explicitly arranges settlement. Past payouts are not a guarantee of
                future payouts. The commissioner is the final authority on all settlement decisions.
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-semibold text-white">No Gambling Guarantee</h3>
              <p>
                Picks, lines, and AI insights provided on this platform are for recreational
                competition only. This is not a licensed gambling operator. Do not rely on any
                information here for real-money wagering decisions.
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-semibold text-white">Acceptable Use</h3>
              <p>
                You agree not to abuse the platform, attempt unauthorized access, manipulate
                results, or collude with other members. Violations may result in immediate account
                suspension.
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-semibold text-white">Changes to These Terms</h3>
              <p>
                The commissioner may update these terms at any time. Continued use of the platform
                after changes constitutes acceptance of the revised terms.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Privacy Policy */}
      <section id="privacy">
        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-7 text-[var(--muted-foreground)]">
            <div>
              <h3 className="mb-1 font-semibold text-white">What We Collect</h3>
              <p>
                We collect your name and email address through our authentication provider
                (Clerk), along with your picks, slips, and activity within the platform. No
                payment card data is stored on our systems.
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-semibold text-white">How We Use It</h3>
              <p>
                Your data is used exclusively to operate the {appName} competition: tracking
                picks, computing leaderboards, sending settlement and digest emails, and
                maintaining audit logs for commissioner oversight.
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-semibold text-white">Third-Party Processors</h3>
              <p>We use the following services to operate the platform:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <span className="text-white">Clerk</span> — authentication and user management
                </li>
                <li>
                  <span className="text-white">Neon / Vercel</span> — database and application
                  hosting
                </li>
                <li>
                  <span className="text-white">Resend</span> — transactional email delivery
                </li>
                <li>
                  <span className="text-white">The Odds API</span> — sports odds data
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-1 font-semibold text-white">Data Sharing</h3>
              <p>
                We do not sell or share your personal information with any third party beyond the
                processors listed above, except as required by law.
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-semibold text-white">Data Retention &amp; Deletion</h3>
              <p>
                Your account and associated data can be removed upon request. Contact the
                commissioner directly to request account deletion.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
