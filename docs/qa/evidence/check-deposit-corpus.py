"""Independent QA oracle: consume generated JSON, inspect geometry, never import game helpers."""
import json
import sys
from collections import Counter, deque


def check(world):
    layout = world['layout']
    width, height = layout['width'], layout['height']
    deposits = world['deposits']
    seats = world['seats']
    expected = {2: 320, 3: 760, 4: 640, 5: 1080}[len(seats)]
    assert sum(d['scrap'] for d in deposits) == expected
    assert len({(d['x'], d['y']) for d in deposits}) == len(deposits)
    assert all(s['scrap'] == 0 for s in seats)
    owned = {s['slot']: s for s in seats}
    signatures = []
    for slot in layout['slots']:
        ox, oy = slot['originX'], slot['originY']
        sector = [d for d in deposits if d['slot'] == slot['index']]
        local = {(d['x'] - ox, d['y'] - oy) for d in sector}
        assert all(2 <= x <= 21 and 2 <= y <= 21 for x, y in local)
        assert Counter(d['kind'] for d in sector) == (
            Counter(small=8, large=2) if slot['index'] in owned else Counter(small=12, large=4))
        assert all(d['scrap'] == (10 if d['kind'] == 'small' else 40) for d in sector)
        is_owned = slot['index'] in owned
        blocked = set(local)
        if is_owned:
            seat = owned[slot['index']]
            cx, cy = seat['core']['x'] - ox, seat['core']['y'] - oy
            blocked.add((cx, cy))
            assert all(abs(x-cx) + abs(y-cy) > 1 for x, y in local)
            signatures.append(sorted((d['kind'], abs(d['x']-seat['core']['x']) + abs(d['y']-seat['core']['y'])) for d in sector))
            starts = [(seat['spawn']['x']-ox, seat['spawn']['y']-oy)]
        else:
            starts = []
            for k in range(24):
                if ox: starts.append((0, k))
                if ox+24 < width: starts.append((23, k))
                if oy: starts.append((k, 0))
                if oy+24 < height: starts.append((k, 23))
        def legal(x, y):
            if not (0 <= x < 24 and 0 <= y < 24) or (x,y) in blocked: return False
            wx, wy = x+ox, y+oy
            return not is_owned or not (
                (0 < wx < width-1 and wx % 24 in (0,23)) or
                (0 < wy < height-1 and wy % 24 in (0,23)))
        reached = {p: 0 for p in starts if legal(*p)}
        queue = deque(reached)
        while queue:
            x,y = queue.popleft()
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nxt = (x+dx, y+dy)
                if nxt not in reached and legal(*nxt):
                    reached[nxt] = reached[(x,y)]+1
                    queue.append(nxt)
        distances = []
        for d in sector:
            x,y = d['x']-ox, d['y']-oy
            shots = []
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                for r in range(1,9):
                    p = (x+dx*r, y+dy*r)
                    if not legal(*p): break
                    if p in reached: shots.append(reached[p])
            assert shots, ('unreachable', d)
            if d['kind'] == 'small': distances.append(min(shots))
        assert not is_owned or min(distances) <= 4
    assert all(s == signatures[0] for s in signatures)


corpus = json.load(sys.stdin)
for entry in corpus:
    check(entry)
print(f"Independent map oracle: {len(corpus)} maps passed budgets, reservations, fairness and firing-path reachability")
