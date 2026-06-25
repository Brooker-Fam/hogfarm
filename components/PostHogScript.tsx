import Script from "next/script";

const INGEST: Record<string, string> = {
  US: "https://us.i.posthog.com",
  EU: "https://eu.i.posthog.com",
};

// The official PostHog web snippet, parameterized with this farm's own project
// key. Auto-captures $pageviews, which flow straight back into the HogFarm
// dashboard via the provisioning token.
//
// We also turn on session replay: `disable_session_recording:false` loads the
// recorder, and `startSessionRecording()` force-starts it so visits record even
// before the project's "Record user sessions" toggle is flipped on. The
// recordings live in the farm's own PostHog project, linked from the dashboard.
export function PostHogScript({ apiKey, region }: { apiKey: string; region: string }) {
  const apiHost = INGEST[region] ?? INGEST.US;
  const snippet = `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('${apiKey}',{api_host:'${apiHost}',person_profiles:'identified_only',disable_session_recording:false});
posthog.startSessionRecording();`;

  return <Script id="ph-snippet" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: snippet }} />;
}
