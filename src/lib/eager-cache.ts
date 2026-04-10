import { useEffect } from "react";
import { getActiveEvent, getAidCategories, getOrganizations } from "@/lib/queries";
import { setCachedOptions } from "@/lib/form-cache";

function cacheReferenceData() {
  getActiveEvent()
    .then((event) => {
      if (!event) return;
      setCachedOptions("activeEvent", [event]);
      getOrganizations(event.id)
        .then((orgs) => setCachedOptions("organizations", orgs))
        .catch(() => {});
    })
    .catch(() => {});

  getAidCategories()
    .then((cats) => setCachedOptions("aidCategories", cats))
    .catch(() => {});
}

export function useEagerCache() {
  useEffect(() => {
    if (navigator.onLine) cacheReferenceData();

    window.addEventListener("online", cacheReferenceData);
    return () => window.removeEventListener("online", cacheReferenceData);
  }, []);
}
