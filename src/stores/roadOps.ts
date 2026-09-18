/**
 * Road lifecycle operations shared by the shell surfaces (header
 * switcher, palette, import dialog, onboarding seeding). A plain module,
 * not a Pinia store: each function resolves its stores at call time.
 */

import { toast } from "../design/toast";
import { downloadRoadFile } from "../lib/download";
import { emptySelectedSubjects, newRoad, renumberName } from "../lib/roads";
import type { Road, SelectedSubject } from "../lib/types";
import { useAuthStore } from "./auth";
import { useCourseDataStore } from "./courseData";
import { history } from "./history";

export function switchRoad(roadID: string): void {
  useCourseDataStore().setActiveRoad(roadID);
}

/** Create a road under a temp id (promoted to a server id on save). */
export function addRoad(
  roadName: string,
  cos: string[] = ["girs"],
  ss: SelectedSubject[][] = emptySelectedSubjects(),
  overrides: Record<string, number> = {},
): string {
  const store = useCourseDataStore();
  const auth = useAuthStore();
  // First free "$n$": the newRoads length alone reissues a live id after
  // a delete-then-create.
  let tempNumber = auth.newRoads.length;
  while (
    "$" + tempNumber + "$" in store.roads ||
    auth.newRoads.includes("$" + tempNumber + "$")
  ) {
    tempNumber++;
  }
  const tempRoadID = "$" + tempNumber + "$";
  const road = newRoad(roadName, cos, ss, overrides);
  store.setRoad({ id: tempRoadID, road, ignoreSet: false });
  store.fulfillmentNeeded = "all";
  store.setActiveRoad(tempRoadID);
  auth.newRoads.push(tempRoadID);
  return tempRoadID;
}

export function createRoad(): void {
  const store = useCourseDataStore();
  const existingNames = Object.values(store.roads).map((r) => r.name);
  const name = existingNames.includes("Untitled road")
    ? renumberName("Untitled road", existingNames)
    : "Untitled road";
  const id = addRoad(name);
  history.record(
    `Created road “${name}”`,
    () => removeRoadEverywhere(id),
    () => {
      store.setRoad({ id, road: newRoad(name), ignoreSet: false });
      store.setActiveRoad(id);
      reregisterLocalRoad(id);
    },
    id,
  );
}

export function duplicateRoad(sourceID: string): void {
  const store = useCourseDataStore();
  const auth = useAuthStore();
  const source = store.roads[sourceID];
  if (source === undefined) {
    return;
  }
  const go = () => {
    const src = store.roads[sourceID];
    const name = renumberName(
      src.name,
      Object.values(store.roads).map((r) => r.name),
    );
    const id = addRoad(
      name,
      src.contents.coursesOfStudy.slice(0),
      JSON.parse(JSON.stringify(src.contents.selectedSubjects)),
      Object.assign({}, src.contents.progressOverrides),
    );
    history.record(
      `Duplicated “${src.name}”`,
      () => removeRoadEverywhere(id),
      () => {
        store.setRoad({
          id,
          road: newRoad(
            name,
            src.contents.coursesOfStudy.slice(0),
            JSON.parse(JSON.stringify(src.contents.selectedSubjects)),
            Object.assign({}, src.contents.progressOverrides),
          ),
          ignoreSet: false,
        });
        store.setActiveRoad(id);
        reregisterLocalRoad(id);
      },
      id,
    );
  };
  if (store.unretrieved.indexOf(sourceID) >= 0) {
    void auth.retrieveRoad(sourceID).then(go);
  } else {
    go();
  }
}

function removeRoadEverywhere(roadID: string): void {
  useAuthStore().deleteRoad(roadID);
}

/**
 * A replayed redo that recreates a road must re-register its id in
 * auth.newRoads, which the undo spliced out.
 */
function reregisterLocalRoad(roadID: string): void {
  const auth = useAuthStore();
  if (roadID.includes("$") && !auth.newRoads.includes(roadID)) {
    auth.newRoads.push(roadID);
  }
}

export function deleteRoadWithUndo(roadID: string): void {
  const store = useCourseDataStore();
  const auth = useAuthStore();
  const road = store.roads[roadID];
  if (road === undefined) {
    return;
  }
  const name = road.name;
  const snapshot: Road = JSON.parse(JSON.stringify(road));
  const restore = () => {
    store.setRoad({
      id: roadID,
      road: JSON.parse(JSON.stringify(snapshot)),
      ignoreSet: false,
    });
    store.setActiveRoad(roadID);
    if (roadID.includes("$") && !auth.newRoads.includes(roadID)) {
      auth.newRoads.push(roadID);
    }
  };
  auth.deleteRoad(roadID);
  history.record(
    `Deleted road “${name}”`,
    restore,
    () => auth.deleteRoad(roadID),
    roadID,
  );
  // Captured by identity: matching on the label can hit a different road
  // with the same name and leave the real entry armed for a later redo.
  const stack = history.state.undoStack;
  const deletionEntry = stack[stack.length - 1];
  toast.undoable(`Deleted “${name}”`, () => {
    if (stack[stack.length - 1] === deletionEntry) {
      history.undo();
    } else {
      history.silence(restore);
      history.drop(deletionEntry);
    }
  });
}

export async function exportActiveRoad(): Promise<void> {
  const store = useCourseDataStore();
  const road = store.roads[store.activeRoad];
  if (road === undefined) {
    return;
  }
  try {
    const outcome = await downloadRoadFile(road.name, road.contents);
    if (outcome !== "cancelled") {
      toast.ok(
        outcome === "shared"
          ? "Road file ready to share"
          : `Exported “${road.name}.road”`,
      );
    }
  } catch (e) {
    console.warn("Failed to export road:", e);
    toast.danger("Couldn't export your road.");
  }
}
