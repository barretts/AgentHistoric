import {useEffect, useState} from "react";
import App from "./App";
import ExpertPage from "./ExpertPage";

function parse(path: string): {kind: "landing"} | {kind: "expert"; slug: string} {
  const m = path.match(/^\/experts\/([a-z0-9-]+)(?:\.html)?\/?$/i);
  if (m) return {kind: "expert", slug: m[1].toLowerCase()};
  return {kind: "landing"};
}

export default function Router() {
  const [path, setPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const route = parse(path);
  if (route.kind === "expert") {
    return <ExpertPage slug={route.slug} />;
  }
  return <App />;
}
