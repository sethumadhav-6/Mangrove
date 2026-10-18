// Kerala mangrove knowledge base: species, associates, nests, birds.
// Each entry gives the label used across the app, the info card, and the zero-shot prompts.
// The prompts only matter for the CLIP engine. A trained custom model uses labels that match `id`.
//
// Status notes on rare species follow Rheedea "Mangroves of Kerala" (the species reported as very rare
// along the Kerala coast). Vernacular (Malayalam) names vary by district; only widely used ones are filled
// in. Add or correct names in the `ml` field.

const A = (s) => `an aerial drone photograph looking down at ${s}`;
const C = (s) => `a close-up drone photo of ${s}`;

export const CATEGORIES = {
  mangrove: { label: 'True mangrove', color: '#5be08f' },
  associate: { label: 'Associate flora', color: '#c6e85a' },
  nest: { label: 'Nest / colony', color: '#ffb547' },
  bird: { label: 'Bird', color: '#5cc8ff' },
  background: { label: 'Background', color: '#8a9a94' },
};

export const MANGROVES = [
  {
    id: 'rhizophora_mucronata', sci: 'Rhizophora mucronata', common: 'Loop-root / Red mangrove', ml: 'Pranthan kandal',
    family: 'Rhizophoraceae', kerala: 'Common; widely planted',
    cues: 'Dense, rounded dark-green crown of large glossy leaves with a pointed tip; arching stilt roots at the fringe; long cigar-like hanging propagules.',
    prompts: [A('a dense dark green Rhizophora mangrove canopy with large glossy leaves'), C('Rhizophora mangrove with arching stilt roots in tidal mud'), C('Rhizophora mucronata mangrove tree with long hanging propagules')],
  },
  {
    id: 'rhizophora_apiculata', sci: 'Rhizophora apiculata', common: 'Tall-stilted mangrove', ml: '',
    family: 'Rhizophoraceae', kerala: 'Occasional; mostly in planted stands',
    cues: 'Like R. mucronata but narrower, darker leaves with reddish petioles; tall straight stems on stilt roots.',
    prompts: [A('a dark green mangrove canopy with narrow pointed leaves and reddish leaf stalks'), C('Rhizophora apiculata mangrove with stilt roots and narrow leaves')],
  },
  {
    id: 'avicennia_officinalis', sci: 'Avicennia officinalis', common: 'Indian mangrove', ml: 'Uppatti',
    family: 'Acanthaceae', kerala: 'Common; dominant along many backwater fringes',
    cues: 'Grey-green to yellowish-green canopy with pale leaf undersides; pencil-like pneumatophores carpeting the mud; orange-yellow flower clusters.',
    prompts: [A('a grey green Avicennia mangrove canopy with pale silvery leaves'), C('Avicennia mangrove with many pencil shaped pneumatophores sticking out of mud'), C('Avicennia officinalis mangrove tree with yellow orange flowers')],
  },
  {
    id: 'avicennia_marina', sci: 'Avicennia marina', common: 'Grey mangrove', ml: '',
    family: 'Acanthaceae', kerala: 'Common on seaward and saline fringes',
    cues: 'Low, shrubby, silvery grey-green canopy of small leaves; dense pneumatophores; usually on the outer, most saline fringe.',
    prompts: [A('low shrubby silvery grey mangrove bushes on a saline mudflat'), C('grey mangrove Avicennia marina shrubs with small leaves and dense pneumatophores')],
  },
  {
    id: 'bruguiera_cylindrica', sci: 'Bruguiera cylindrica', common: 'Small-leaved orange mangrove', ml: '',
    family: 'Rhizophoraceae', kerala: 'Frequent in Kannur and Kozhikode estuaries',
    cues: 'Light-green, open canopy; knee roots looping out of the mud; slender cylindrical propagules.',
    prompts: [A('a light green open mangrove canopy with knee roots looping out of mud'), C('Bruguiera mangrove with knee roots and slender cylindrical propagules')],
  },
  {
    id: 'bruguiera_gymnorrhiza', sci: 'Bruguiera gymnorrhiza', common: 'Large-leaved orange mangrove', ml: '',
    family: 'Rhizophoraceae', kerala: 'Very rare',
    cues: 'Large leathery leaves; conspicuous red calyx flowers; knee roots.',
    prompts: [C('Bruguiera gymnorrhiza mangrove with bright red flowers and large leaves')],
  },
  {
    id: 'bruguiera_sexangula', sci: 'Bruguiera sexangula', common: 'Upriver orange mangrove', ml: '',
    family: 'Rhizophoraceae', kerala: 'Very rare',
    cues: 'Similar to B. gymnorrhiza with yellowish-orange calyx; knee roots.',
    prompts: [C('Bruguiera sexangula mangrove with orange yellow flowers')],
  },
  {
    id: 'kandelia_candel', sci: 'Kandelia candel', common: 'Kandelia', ml: '',
    family: 'Rhizophoraceae', kerala: 'Occasional along creek banks',
    cues: 'Shrubby, bright light-green crown; white star flowers; long slender propagules; brackish creek banks.',
    prompts: [A('a small shrubby bright light green mangrove along a brackish creek bank'), C('Kandelia candel mangrove with white flowers and long slender propagules')],
  },
  {
    id: 'sonneratia_caseolaris', sci: 'Sonneratia caseolaris', common: 'Mangrove apple', ml: 'Blathi',
    family: 'Lythraceae', kerala: 'Common on low-salinity river and backwater banks',
    cues: 'Tall trees with drooping branches and rounded leaves; thick conical pneumatophores; red-and-white powder-puff flowers; apple-like fruits.',
    prompts: [A('tall mangrove apple trees with drooping branches along a river bank'), C('Sonneratia mangrove with thick conical pneumatophores and round leaves'), C('Sonneratia caseolaris with red powder puff flowers')],
  },
  {
    id: 'sonneratia_alba', sci: 'Sonneratia alba', common: 'White mangrove apple', ml: '',
    family: 'Lythraceae', kerala: 'Very rare',
    cues: 'Seaward Sonneratia with leathery rounded leaves and white flowers.',
    prompts: [C('Sonneratia alba mangrove with white flowers and rounded leathery leaves')],
  },
  {
    id: 'excoecaria_agallocha', sci: 'Excoecaria agallocha', common: 'Blinding tree / Milky mangrove', ml: 'Kannampotti',
    family: 'Euphorbiaceae', kerala: 'Common on the landward fringe',
    cues: 'Light-green to yellow canopy that turns orange-red before leaf fall; milky latex; landward side, often near bunds.',
    prompts: [A('a landward mangrove tree with light green and orange red leaves'), C('Excoecaria agallocha milky mangrove tree with red leaves')],
  },
  {
    id: 'excoecaria_indica', sci: 'Excoecaria indica', common: 'Indian excoecaria', ml: '',
    family: 'Euphorbiaceae', kerala: 'Very rare',
    cues: 'Spiny shrub or small tree; rare. Confirm on the ground.',
    prompts: [C('Excoecaria indica spiny mangrove shrub')],
  },
  {
    id: 'aegiceras_corniculatum', sci: 'Aegiceras corniculatum', common: 'River mangrove', ml: '',
    family: 'Primulaceae', kerala: 'Common in brackish creeks',
    cues: 'Low shrub thickets; obovate leaves with pinkish young flush; white fragrant flower clusters; curved horn-shaped fruits.',
    prompts: [A('low shrubby river mangrove thickets with pinkish young leaves'), C('Aegiceras corniculatum shrub with white flowers and curved horn shaped fruits')],
  },
  {
    id: 'lumnitzera_racemosa', sci: 'Lumnitzera racemosa', common: 'White-flowered black mangrove', ml: '',
    family: 'Combretaceae', kerala: 'Very rare',
    cues: 'Shrub with small fleshy leaves crowded at branch tips; white flower spikes; landward.',
    prompts: [C('Lumnitzera racemosa shrub with small fleshy leaves and white flower spikes')],
  },
  {
    id: 'acanthus_ilicifolius', sci: 'Acanthus ilicifolius', common: 'Holly mangrove', ml: 'Chulli',
    family: 'Acanthaceae', kerala: 'Very common as undergrowth and edge thickets',
    cues: 'Low dense spiny thickets of holly-like leaves; pale violet-blue flower spikes; along channel edges and under canopy gaps.',
    prompts: [A('low dense thickets of spiny holly leaved shrubs at a mangrove edge'), C('Acanthus ilicifolius holly mangrove with spiny leaves and violet blue flowers')],
  },
  {
    id: 'ceriops_tagal', sci: 'Ceriops tagal', common: 'Spurred mangrove', ml: '',
    family: 'Rhizophoraceae', kerala: 'Historically reported; not located in recent surveys',
    cues: 'Shrub with glossy obovate leaves clustered at tips; ridged, club-shaped propagules.',
    prompts: [C('Ceriops tagal mangrove shrub with glossy obovate leaves')],
  },
];

export const ASSOCIATES = [
  { id: 'acrostichum_aureum', sci: 'Acrostichum aureum', common: 'Golden leather fern', ml: '', family: 'Pteridaceae',
    cues: 'Large clumps of bright-green leathery fronds, rusty undersides on fertile fronds; disturbed and landward patches.',
    prompts: [A('large clumps of bright green mangrove fern fronds'), C('Acrostichum aureum golden leather fern in a mangrove')] },
  { id: 'cerbera_odollam', sci: 'Cerbera odollam', common: 'Pong-pong / Suicide tree', ml: 'Othalam', family: 'Apocynaceae',
    cues: 'Rosettes of glossy elongated leaves at branch tips; white flowers; green mango-like fruits.',
    prompts: [C('Cerbera odollam tree with glossy leaf rosettes white flowers and green round fruits')] },
  { id: 'thespesia_populnea', sci: 'Thespesia populnea', common: 'Portia tree', ml: 'Poovarasu', family: 'Malvaceae',
    cues: 'Heart-shaped leaves; yellow hibiscus-like flowers with maroon centre.',
    prompts: [C('Thespesia populnea portia tree with heart shaped leaves and yellow flowers')] },
  { id: 'hibiscus_tiliaceus', sci: 'Talipariti tiliaceum', common: 'Sea hibiscus', ml: '', family: 'Malvaceae',
    cues: 'Sprawling shrub with large round heart-shaped leaves; yellow flowers.',
    prompts: [C('sea hibiscus shrub with large round heart shaped leaves and yellow flowers')] },
  { id: 'clerodendrum_inerme', sci: 'Volkameria inermis', common: 'Seaside clerodendrum', ml: '', family: 'Lamiaceae',
    cues: 'Scrambling hedges of small opposite leaves along bunds; white tubular flowers.',
    prompts: [C('Clerodendrum inerme scrambling shrub hedge with white tubular flowers')] },
  { id: 'derris_trifoliata', sci: 'Derris trifoliata', common: 'Derris climber', ml: '', family: 'Fabaceae',
    cues: 'Woody climber draped over mangrove crowns.',
    prompts: [A('a woody climbing vine draped over mangrove tree crowns')] },
  { id: 'pandanus', sci: 'Pandanus spp.', common: 'Screw pine', ml: 'Kaitha', family: 'Pandanaceae',
    cues: 'Spiral rosettes of long sword-like leaves on prop roots; often along bunds.',
    prompts: [A('screw pine Pandanus plants with spiral rosettes of long sword leaves'), C('Pandanus screw pine with prop roots')] },
  { id: 'calophyllum_inophyllum', sci: 'Calophyllum inophyllum', common: 'Alexandrian laurel', ml: 'Punna', family: 'Calophyllaceae',
    cues: 'Broad dark glossy leaves with fine parallel veins; spreading crown.',
    prompts: [C('Calophyllum inophyllum tree with dark glossy leaves')] },
  { id: 'sesuvium_portulacastrum', sci: 'Sesuvium portulacastrum', common: 'Sea purslane', ml: '', family: 'Aizoaceae',
    cues: 'Creeping succulent mats, green to reddish, on saline mudflats and bunds.',
    prompts: [A('creeping reddish green succulent sea purslane mats on a saline mudflat')] },
];

export const NESTS = [
  { id: 'heronry_colony', sci: 'Ardeid / cormorant colony', common: 'Heronry (egret, night heron, cormorant nests)', family: 'Nesting colony',
    cues: 'Many stick nests close together in mangrove crowns, white droppings on leaves, adults and chicks visible.',
    prompts: [A('a heronry with many egret and cormorant stick nests in mangrove tree tops'), A('white bird droppings and many bird nests on top of trees'), C('egret nests with chicks in a mangrove canopy')] },
  { id: 'stick_nest', sci: 'Raptor / large stick nest', common: 'Large stick nest (e.g. Brahminy Kite)', family: 'Nest',
    cues: 'Single bulky platform of sticks in a tall crown.',
    prompts: [A('a single large stick bird nest on top of a tree'), C('a bulky raptor nest made of sticks in a tree crown')] },
  { id: 'nest_with_chicks', sci: 'Active nest', common: 'Nest with eggs or chicks', family: 'Nest',
    cues: 'Nest cup with eggs or chicks visible.',
    prompts: [C('a bird nest with chicks inside'), C('a bird nest with eggs inside')] },
];

// Habitat / non-target classes absorb probability so empty water or mud is not forced into a species.
export const BACKGROUND = [
  { id: 'open_water', common: 'Open water / channel', prompts: [A('open water of a backwater channel'), A('a river surface with ripples')] },
  { id: 'mudflat', common: 'Mudflat / bare mud', prompts: [A('a bare tidal mudflat'), A('wet brown mud with no vegetation')] },
  { id: 'coconut_palms', common: 'Coconut palms', prompts: [A('coconut palm trees'), A('coconut palm crowns from above')] },
  { id: 'paddy_grass', common: 'Paddy / pokkali field / grass', prompts: [A('a paddy field or pokkali rice field'), A('wetland grass and reeds')] },
  { id: 'built_up', common: 'Roads, buildings, boats', prompts: [A('houses, roofs and roads'), A('boats and a fishing jetty')] },
  { id: 'sand_beach', common: 'Sand / beach', prompts: [A('a sandy beach')] },
  { id: 'sky', common: 'Sky / horizon', prompts: ['a photo of the sky and horizon', 'a blurry photo with clouds'] },
  { id: 'other_trees', common: 'Other terrestrial trees', prompts: [A('mixed terrestrial trees and garden vegetation')] },
];

// Birds of Kerala mangroves and backwaters. Large waterbirds are realistic to identify from a drone at low altitude;
// small passerines are not and are deliberately left out.
const B = (s) => [`a photo of a ${s}`, `a drone photo of a ${s} seen from above`];
export const BIRDS = [
  { id: 'little_egret', sci: 'Egretta garzetta', common: 'Little Egret', cues: 'Small white egret, black bill, black legs with yellow feet.', prompts: B('Little Egret, a small white egret with a black bill') },
  { id: 'great_egret', sci: 'Ardea alba', common: 'Great Egret', cues: 'Large white egret, long neck with a kink, yellow bill (non-breeding).', prompts: B('Great Egret, a large white egret with a yellow bill') },
  { id: 'intermediate_egret', sci: 'Ardea intermedia', common: 'Intermediate Egret', cues: 'Mid-sized white egret, shorter yellow bill.', prompts: B('Intermediate Egret') },
  { id: 'cattle_egret', sci: 'Bubulcus ibis', common: 'Cattle Egret', cues: 'Stocky white egret, orange-buff wash when breeding.', prompts: B('Cattle Egret, a stocky white egret') },
  { id: 'western_reef_heron', sci: 'Egretta gularis', common: 'Western Reef Heron', cues: 'Dark slate-grey (or white) heron with white throat, on the coast.', prompts: B('Western Reef Heron, a dark grey heron with a white throat') },
  { id: 'indian_pond_heron', sci: 'Ardeola grayii', common: 'Indian Pond Heron', cues: 'Brown streaked when perched, flashes white wings in flight.', prompts: B('Indian Pond Heron, a brown streaked heron with white wings') },
  { id: 'grey_heron', sci: 'Ardea cinerea', common: 'Grey Heron', cues: 'Very large grey heron with black head stripe.', prompts: B('Grey Heron') },
  { id: 'purple_heron', sci: 'Ardea purpurea', common: 'Purple Heron', cues: 'Slim rufous-and-grey heron with striped neck.', prompts: B('Purple Heron, a rufous and grey heron') },
  { id: 'night_heron', sci: 'Nycticorax nycticorax', common: 'Black-crowned Night Heron', cues: 'Stocky grey heron with black crown and back; roosts in mangroves.', prompts: B('Black-crowned Night Heron, a stocky grey heron with a black back') },
  { id: 'striated_heron', sci: 'Butorides striata', common: 'Striated Heron', cues: 'Small dark grey-green heron along mangrove edges.', prompts: B('Striated Heron, a small dark heron') },
  { id: 'little_cormorant', sci: 'Microcarbo niger', common: 'Little Cormorant', cues: 'Small all-black cormorant.', prompts: B('Little Cormorant, a small black cormorant') },
  { id: 'indian_cormorant', sci: 'Phalacrocorax fuscicollis', common: 'Indian Cormorant', cues: 'Larger black cormorant with slender bill.', prompts: B('Indian Cormorant') },
  { id: 'oriental_darter', sci: 'Anhinga melanogaster', common: 'Oriental Darter', cues: 'Snake-like neck; often drying wings spread.', prompts: B('Oriental Darter, a snakebird with a long thin neck') },
  { id: 'black_headed_ibis', sci: 'Threskiornis melanocephalus', common: 'Black-headed Ibis', cues: 'White body, bare black head and down-curved bill.', prompts: B('Black-headed Ibis, a white ibis with a black head') },
  { id: 'asian_openbill', sci: 'Anastomus oscitans', common: 'Asian Openbill', cues: 'Grey-white stork with black flight feathers and gap in bill.', prompts: B('Asian Openbill stork') },
  { id: 'brahminy_kite', sci: 'Haliastur indus', common: 'Brahminy Kite', cues: 'Chestnut raptor with white head and breast.', prompts: B('Brahminy Kite, a chestnut brown raptor with a white head') },
  { id: 'black_kite', sci: 'Milvus migrans', common: 'Black Kite', cues: 'Dark brown raptor with forked tail.', prompts: B('Black Kite, a dark brown raptor with a forked tail') },
  { id: 'white_bellied_sea_eagle', sci: 'Haliaeetus leucogaster', common: 'White-bellied Sea Eagle', cues: 'Large grey-and-white eagle.', prompts: B('White-bellied Sea Eagle') },
  { id: 'osprey', sci: 'Pandion haliaetus', common: 'Osprey (winter)', cues: 'Brown-and-white fish hawk with dark eye stripe.', prompts: B('Osprey') },
  { id: 'white_throated_kingfisher', sci: 'Halcyon smyrnensis', common: 'White-throated Kingfisher', cues: 'Brown head, white throat, electric blue back.', prompts: B('White-throated Kingfisher') },
  { id: 'stork_billed_kingfisher', sci: 'Pelargopsis capensis', common: 'Stork-billed Kingfisher', cues: 'Large kingfisher with huge red bill.', prompts: B('Stork-billed Kingfisher with a huge red bill') },
  { id: 'pied_kingfisher', sci: 'Ceryle rudis', common: 'Pied Kingfisher', cues: 'Black-and-white kingfisher, hovers over water.', prompts: B('Pied Kingfisher, a black and white kingfisher') },
  { id: 'common_kingfisher', sci: 'Alcedo atthis', common: 'Common Kingfisher', cues: 'Small blue-and-orange kingfisher.', prompts: B('Common Kingfisher') },
  { id: 'black_capped_kingfisher', sci: 'Halcyon pileata', common: 'Black-capped Kingfisher', cues: 'Black cap, white collar, purple-blue back.', prompts: B('Black-capped Kingfisher') },
  { id: 'whimbrel', sci: 'Numenius phaeopus', common: 'Whimbrel', cues: 'Brown wader with long down-curved bill on mudflats.', prompts: B('Whimbrel, a brown wader with a long curved bill') },
  { id: 'common_sandpiper', sci: 'Actitis hypoleucos', common: 'Common Sandpiper', cues: 'Small brown wader bobbing at water edge.', prompts: B('Common Sandpiper') },
  { id: 'redshank', sci: 'Tringa totanus', common: 'Common Redshank', cues: 'Wader with red legs.', prompts: B('Common Redshank, a wader with red legs') },
  { id: 'gull_tern', sci: 'Laridae', common: 'Gull / Tern', cues: 'Grey-and-white seabird.', prompts: B('gull or tern') },
];

// Habitat / survey sites in Kerala (for the session form).
export const SITES = [
  'Mangalavanam Bird Sanctuary, Kochi', 'Puthuvype, Ernakulam', 'Kumbalangi, Ernakulam', 'Vypeen / Njarakkal, Ernakulam',
  'Kadalundi–Vallikkunnu Community Reserve', 'Pappinissery, Kannur', 'Kunhimangalam, Kannur', 'Valapattanam, Kannur',
  'Kavvayi backwaters, Payyannur', 'Thalassery / Dharmadam, Kannur', 'Chettuva, Thrissur', 'Kumarakom, Kottayam',
  'Ashtamudi, Kollam', 'Ayiramthengu, Kollam', 'Other',
];

export function allTileClasses() {
  return [
    ...MANGROVES.map((s) => ({ ...s, cat: 'mangrove' })),
    ...ASSOCIATES.map((s) => ({ ...s, cat: 'associate' })),
    ...NESTS.map((s) => ({ ...s, cat: 'nest' })),
    ...BACKGROUND.map((s) => ({ ...s, cat: 'background' })),
  ];
}
export function allBirdClasses() { return BIRDS.map((s) => ({ ...s, cat: 'bird' })); }

const INDEX = new Map();
for (const c of [...allTileClasses(), ...allBirdClasses()]) INDEX.set(c.id, c);
INDEX.set('bird', { id: 'bird', common: 'Bird (species not resolved)', sci: 'Aves', cat: 'bird', cues: 'Detected as a bird. Fly lower or zoom in for species.' });
INDEX.set('nest', { id: 'nest', common: 'Nest', sci: '', cat: 'nest', cues: '' });

// Look up info for any label, including labels from a custom-trained model.
export function info(id) {
  if (INDEX.has(id)) return INDEX.get(id);
  const l = String(id).toLowerCase();
  const cat = /nest|colony|heronry/.test(l) ? 'nest' : /bird|egret|heron|kite|cormorant|kingfisher|ibis/.test(l) ? 'bird' : 'mangrove';
  return { id, common: id.replace(/_/g, ' '), sci: '', cat, cues: '' };
}
