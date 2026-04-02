import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import StatusFooter from "@/components/StatusFooter";

const PLACEHOLDER_STORIES = [
  {
    id: 1,
    title: "Relief Operations in Northern Sector",
    date: "April 2, 2026",
    excerpt:
      "Distribution of essential supplies including water, hygiene kits, and sleeping mats to over 500 affected families...",
  },
  {
    id: 2,
    title: "Community Kitchen Setup",
    date: "April 1, 2026",
    excerpt:
      "Volunteers have established a central kitchen to provide hot meals for the displaced residents in the coastal areas...",
  },
  {
    id: 3,
    title: "Medical Team Arrival",
    date: "March 31, 2026",
    excerpt:
      "Volunteer doctors and nurses have arrived to provide medical checkups, first aid, and basic medicine distribution...",
  },
];

export function StoriesPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-base text-neutral-50">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-6 py-12 flex-grow">
        <div className="mb-12 border-b border-neutral-800 pb-6 text-center lg:text-left flex flex-col lg:flex-row justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {t("Navigation.stories")}
            </h1>
            <p className="mt-2 text-neutral-400">
              Read about our latest community relief efforts.
            </p>
          </div>
          <div className="mt-4 lg:mt-0 rounded-full bg-primary/20 px-4 py-1.5 text-sm font-medium text-primary border border-primary/30">
            {t("Stories.comingSoon", "Coming Soon")}
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {PLACEHOLDER_STORIES.map((story) => (
            <article
              key={story.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 transition-all hover:border-neutral-700"
            >
              {/* Lightweight Image Placeholder */}
              <div className="aspect-video w-full bg-neutral-800 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-neutral-700 transition-transform group-hover:scale-110"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
              </div>
              
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <time className="mb-2 block text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    {story.date}
                  </time>
                  <h3 className="mb-3 text-xl font-semibold leading-snug">
                    <a href="#" className="hover:text-primary transition-colors">
                      {story.title}
                    </a>
                  </h3>
                  <p className="text-sm text-neutral-400 line-clamp-3">
                    {story.excerpt}
                  </p>
                </div>
                
                <div className="mt-6 border-t border-neutral-800 pt-4">
                  <a
                    href="#"
                    className="flex items-center text-sm font-medium text-primary hover:text-primary/80"
                  >
                    Read full story
                    <svg
                      className="ml-1 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
      <StatusFooter />
    </div>
  );
}
