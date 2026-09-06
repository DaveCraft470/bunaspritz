export type DrinkCategory =
  | 'Vodka'
  | 'Whiskey'
  | 'Whisky'
  | 'Rum'
  | 'Gin'
  | 'Tequila'
  | 'Brandy'
  | 'Cognac'
  | 'Liqueur'
  | 'Bitters'
  | 'Aperitif'
  | 'Vermouth'
  | 'Beer'
  | 'Cider'
  | 'Wine'
  | 'Sparkling wine'
  | 'Champagne'
  | 'Soft drinks'
  | 'Cola'
  | 'Lemon-lime'
  | 'Energy drinks'
  | 'Water'
  | 'Juice'
  | 'Tonic'
  | 'Mixers'
  | 'Cocktails'
  | 'Non-alcoholic drinks'
  | 'Cocktails / Spritz ingredients'
  | 'Coffee Liqueur'
  | 'Vinars'
  | 'Sake'
  | 'Shochu'
  | 'Ouzo'
  | 'Rachiu'
  | 'Pălincă'
  | 'Afinată'
  | 'Vișinată';

export type DrinkQuickFilter = 'all' | 'spirits' | 'beer' | 'wine' | 'soft' | 'energy';

export const DRINK_QUICK_FILTER_CATEGORIES: Record<DrinkQuickFilter, DrinkCategory[] | null> = {
  all: null,
  spirits: ['Vodka', 'Whiskey', 'Whisky', 'Rum', 'Gin', 'Tequila', 'Brandy', 'Cognac', 'Liqueur', 'Bitters', 'Aperitif', 'Vermouth'],
  beer: ['Beer'],
  wine: ['Wine', 'Sparkling wine', 'Champagne'],
  soft: ['Soft drinks', 'Cola', 'Lemon-lime', 'Juice', 'Water', 'Tonic', 'Mixers', 'Non-alcoholic drinks'],
  energy: ['Energy drinks'],
};

export type DrinkCatalogItem = {
  id: string;
  name: string;
  brand: string;
  category: DrinkCategory;
  aliases: string[];
  volumesMl: number[];
  packagingTypes?: PackagingType[];
  subcategory?: string;
  alcoholPercent?: number;
  alcoholFree?: boolean;
  source?: 'curated-retail';
};

export type PackagingType = 'can' | 'bottle' | 'PET' | 'bag-in-box' | 'magnum' | 'box' | 'carton' | 'pouch';
export type QuantityMode = 'units' | 'liters';

export type EventDrink = {
  id: string;
  productId?: string;
  name: string;
  brand?: string;
  category?: DrinkCategory;
  volumeMl?: number;
  quantity: number;
  quantityMode?: QuantityMode;
  totalLiters?: number;
  packagingType?: PackagingType;
  source?: 'local' | 'openfoodfacts';
  imageUrl?: string;
};

type Seed = [string, string, DrinkCategory, number[], string[]?] | {
  id: string;
  name: string;
  brand: string;
  category: DrinkCategory;
  volumesMl: number[];
};

const seeds: Seed[] = [
  { id: 'jagermeister', name: 'Jägermeister', brand: 'Jägermeister', category: 'Liqueur', volumesMl: [250, 500, 700, 750, 1000] },
  { id: 'absolut-vodka', name: 'Absolut Vodka', brand: 'Absolut', category: 'Vodka', volumesMl: [200, 500, 700, 1000] },
  { id: 'smirnoff-vodka', name: 'Smirnoff Vodka', brand: 'Smirnoff', category: 'Vodka', volumesMl: [200, 500, 700, 1000] },
  { id: 'finlandia-vodka', name: 'Finlandia Vodka', brand: 'Finlandia', category: 'Vodka', volumesMl: [500, 700, 1000] },
  { id: 'jack-daniels', name: "Jack Daniel's", brand: "Jack Daniel's", category: 'Whiskey', volumesMl: [200, 500, 700, 1000] },
  { id: 'johnnie-walker-red', name: 'Johnnie Walker Red Label', brand: 'Johnnie Walker', category: 'Whisky', volumesMl: [200, 500, 700, 1000] },
  { id: 'johnnie-walker-black', name: 'Johnnie Walker Black Label', brand: 'Johnnie Walker', category: 'Whisky', volumesMl: [700, 1000] },
  { id: 'jameson', name: 'Jameson', brand: 'Jameson', category: 'Whiskey', volumesMl: [200, 500, 700, 1000] },
  { id: 'chivas-regal', name: 'Chivas Regal', brand: 'Chivas Regal', category: 'Whisky', volumesMl: [700, 1000] },
  { id: 'captain-morgan', name: 'Captain Morgan Spiced Gold', brand: 'Captain Morgan', category: 'Rum', volumesMl: [500, 700, 1000] },
  { id: 'bacardi', name: 'Bacardi Carta Blanca', brand: 'Bacardi', category: 'Rum', volumesMl: [500, 700, 1000] },
  { id: 'havana-club', name: 'Havana Club 3 Años', brand: 'Havana Club', category: 'Rum', volumesMl: [700, 1000] },
  { id: 'gordons', name: "Gordon's Gin", brand: "Gordon's", category: 'Gin', volumesMl: [500, 700, 1000] },
  { id: 'tanqueray', name: 'Tanqueray London Dry Gin', brand: 'Tanqueray', category: 'Gin', volumesMl: [700, 1000] },
  { id: 'beefeater', name: 'Beefeater London Dry Gin', brand: 'Beefeater', category: 'Gin', volumesMl: [700, 1000] },
  { id: 'olmeca', name: 'Olmeca Blanco', brand: 'Olmeca', category: 'Tequila', volumesMl: [500, 700] },
  { id: 'aperol', name: 'Aperol', brand: 'Aperol', category: 'Liqueur', volumesMl: [700, 1000] },
  { id: 'campari', name: 'Campari', brand: 'Campari', category: 'Liqueur', volumesMl: [700, 1000] },
  { id: 'baileys', name: "Baileys Original", brand: 'Baileys', category: 'Liqueur', volumesMl: [500, 700] },
  { id: 'coca-cola', name: 'Coca-Cola', brand: 'Coca-Cola', category: 'Soft drinks', volumesMl: [330, 500, 1000, 1500, 2000] },
  { id: 'pepsi', name: 'Pepsi', brand: 'Pepsi', category: 'Soft drinks', volumesMl: [330, 500, 1000, 1500, 2000] },
  { id: 'sprite', name: 'Sprite', brand: 'Sprite', category: 'Soft drinks', volumesMl: [330, 500, 1000, 1500, 2000] },
  { id: 'fanta', name: 'Fanta Orange', brand: 'Fanta', category: 'Soft drinks', volumesMl: [330, 500, 1000, 1500, 2000] },
  { id: 'tonic', name: 'Schweppes Tonic', brand: 'Schweppes', category: 'Soft drinks', volumesMl: [330, 500, 1000] },
  { id: 'red-bull', name: 'Red Bull', brand: 'Red Bull', category: 'Energy drinks', volumesMl: [250, 355, 473] },
  { id: 'monster', name: 'Monster Energy', brand: 'Monster', category: 'Energy drinks', volumesMl: [500] },
  { id: 'borsec', name: 'Apă minerală Borsec', brand: 'Borsec', category: 'Water', volumesMl: [500, 750, 1500] },
  { id: 'dorna', name: 'Apă plată Dorna', brand: 'Dorna', category: 'Water', volumesMl: [500, 750, 2000] },
  { id: 'ursus', name: 'Ursus', brand: 'Ursus', category: 'Beer', volumesMl: [330, 500] },
  { id: 'ciuc', name: 'Ciuc Premium', brand: 'Ciuc', category: 'Beer', volumesMl: [330, 500] },
  { id: 'silva', name: 'Silva Strong Dark Lager', brand: 'Silva', category: 'Beer', volumesMl: [500] },
  { id: 'heineken', name: 'Heineken', brand: 'Heineken', category: 'Beer', volumesMl: [330, 500] },
  { id: 'corona', name: 'Corona Extra', brand: 'Corona', category: 'Beer', volumesMl: [355, 710] },
  { id: 'budweiser', name: 'Budweiser', brand: 'Budweiser', category: 'Beer', volumesMl: [330, 500] },
  { id: 'wine-house-red', name: 'Vin roșu', brand: 'Vinul casei', category: 'Wine', volumesMl: [750, 1500] },
  { id: 'wine-house-white', name: 'Vin alb', brand: 'Vinul casei', category: 'Wine', volumesMl: [750, 1500] },
  { id: 'prosecco', name: 'Prosecco', brand: 'Prosecco', category: 'Sparkling wine', volumesMl: [750, 1500] },
  { id: 'champagne', name: 'Champagne', brand: 'Champagne', category: 'Sparkling wine', volumesMl: [750] },
  { id: 'sparkling-water', name: 'Apă minerală carbogazoasă', brand: 'Generic', category: 'Water', volumesMl: [500, 750, 1500] },
  { id: 'soda-water', name: 'Sodă', brand: 'Generic', category: 'Cocktails / Spritz ingredients', volumesMl: [500, 1000, 1500] },
  { id: 'orange-juice', name: 'Suc de portocale', brand: 'Generic', category: 'Cocktails / Spritz ingredients', volumesMl: [1000, 1500] },
  { id: 'lime-juice', name: 'Suc de lime', brand: 'Generic', category: 'Cocktails / Spritz ingredients', volumesMl: [200, 500] },
  ['Belvedere Vodka', 'Belvedere', 'Vodka', [500, 700, 1000], ['belvedere']],
  ['Grey Goose Vodka', 'Grey Goose', 'Vodka', [500, 700, 1000], ['grey goose', 'greygoose']],
  ['Russian Standard Vodka', 'Russian Standard', 'Vodka', [500, 700, 1000], ['russian standard']],
  ['Żubrówka Bison Grass', 'Żubrówka', 'Vodka', [500, 700], ['zubrowka', 'zubrówka']],
  ['Wyborowa Vodka', 'Wyborowa', 'Vodka', [500, 700], ['wyborowa']],
  ['Ketel One Vodka', 'Ketel One', 'Vodka', [700, 1000], ['ketel one']],
  ['Cîroc Vodka', 'Cîroc', 'Vodka', [700, 1000], ['ciroc']],
  ['Skyy Vodka', 'SKYY', 'Vodka', [700, 1000], ['skyy']],
  ['Stolichnaya Vodka', 'Stolichnaya', 'Vodka', [500, 700], ['stoli']],
  ['Nemiroff Vodka', 'Nemiroff', 'Vodka', [500, 700], ['nemiroff']],
  ['Jameson Black Barrel', 'Jameson', 'Whiskey', [700], ['jameson black']],
  ['Bushmills Original', 'Bushmills', 'Whisky', [700], ['bushmills']],
  ['Tullamore D.E.W.', 'Tullamore D.E.W.', 'Whiskey', [700, 1000], ['tullamore', 'dew']],
  ["Ballantine's Finest", "Ballantine's", 'Whisky', [500, 700, 1000], ['ballantines', 'ballantine']],
  ["J&B Rare", 'J&B', 'Whisky', [700, 1000], ['j&b', 'jb rare']],
  ['Jim Beam White', 'Jim Beam', 'Whiskey', [700, 1000], ['jim beam']],
  ["Maker's Mark", "Maker's Mark", 'Whiskey', [700], ['makers mark']],
  ['Four Roses Bourbon', 'Four Roses', 'Whiskey', [700], ['four roses']],
  ['Bulleit Bourbon', 'Bulleit', 'Whiskey', [700], ['bulleit']],
  ['The Famous Grouse', 'The Famous Grouse', 'Whisky', [700], ['famous grouse']],
  ['Monkey Shoulder', 'Monkey Shoulder', 'Whisky', [700], ['monkey shoulder']],
  ['Glenfiddich 12', 'Glenfiddich', 'Whisky', [700], ['glenfiddich']],
  ['Glenlivet 12', 'The Glenlivet', 'Whisky', [700], ['glenlivet']],
  ['Laphroaig 10', 'Laphroaig', 'Whisky', [700], ['laphroaig']],
  ['Talisker 10', 'Talisker', 'Whisky', [700], ['talisker']],
  ['Diplomático Reserva Exclusiva', 'Diplomático', 'Rum', [700], ['diplomatico']],
  ['Plantation 3 Stars', 'Plantation', 'Rum', [700], ['plantation']],
  ['Mount Gay Eclipse', 'Mount Gay', 'Rum', [700], ['mount gay']],
  ['Don Papa Rum', 'Don Papa', 'Rum', [700], ['don papa']],
  ['Flor de Caña 7', 'Flor de Caña', 'Rum', [700], ['flor de cana']],
  ['Sailor Jerry Spiced Rum', 'Sailor Jerry', 'Rum', [700], ['sailor jerry']],
  ['The Kraken Black Spiced', 'Kraken', 'Rum', [700], ['kraken']],
  ['Bacardi Spiced', 'Bacardi', 'Rum', [700], ['bacardi spiced']],
  ['Malibu Coconut', 'Malibu', 'Liqueur', [500, 700], ['malibu']],
  ['Bombay Sapphire', 'Bombay Sapphire', 'Gin', [500, 700, 1000], ['bombay', 'bombay sapphire']],
  ["Hendrick's Gin", "Hendrick's", 'Gin', [700], ['hendricks', 'hendrick']],
  ['Roku Gin', 'Roku', 'Gin', [700], ['roku']],
  ['Monkey 47', 'Monkey 47', 'Gin', [500], ['monkey 47']],
  ['Nordés Gin', 'Nordés', 'Gin', [700], ['nordes', 'nordés']],
  ['The Botanist Gin', 'The Botanist', 'Gin', [700], ['botanist']],
  ['Aviation Gin', 'Aviation', 'Gin', [700], ['aviation']],
  ['Malfy Con Limone', 'Malfy', 'Gin', [700], ['malfy limone']],
  ['Patrón Silver', 'Patrón', 'Tequila', [700], ['patron']],
  ['Jose Cuervo Especial', 'Jose Cuervo', 'Tequila', [700], ['jose cuervo', 'cuervo']],
  ['Don Julio Blanco', 'Don Julio', 'Tequila', [700], ['don julio']],
  ['Hennessy VS', 'Hennessy', 'Cognac', [350, 700], ['hennessy']],
  ['Hennessy VSOP', 'Hennessy', 'Cognac', [700], ['hennessy vsop']],
  ['Rémy Martin VSOP', 'Rémy Martin', 'Cognac', [700], ['remy martin', 'remy']],
  ['Martell VS', 'Martell', 'Cognac', [700], ['martell']],
  ['Metaxa 5 Stars', 'Metaxa', 'Brandy', [700], ['metaxa']],
  ['Vecchia Romagna', 'Vecchia Romagna', 'Brandy', [700], ['vecchia romagna']],
  ['Kahlúa', 'Kahlúa', 'Liqueur', [700], ['kahlua', 'kahlúa']],
  ['Cointreau', 'Cointreau', 'Liqueur', [350, 700], ['cointreau']],
  ['Disaronno Originale', 'Disaronno', 'Liqueur', [500, 700], ['disaronno', 'amaretto']],
  ['Sambuca Molinari', 'Molinari', 'Liqueur', [700], ['sambuca', 'molinari']],
  ['Limoncello', 'Limoncello', 'Liqueur', [500, 700], ['limoncello']],
  ['Frangelico', 'Frangelico', 'Liqueur', [700], ['frangelico']],
  ['Crème de Cassis', 'Lejay', 'Liqueur', [700], ['creme de cassis', 'cassis']],
  ['Angostura Aromatic Bitters', 'Angostura', 'Bitters', [100, 200], ['angostura', 'bitters']],
  ['Peychaud’s Bitters', 'Peychaud’s', 'Bitters', [148], ['peychau', 'bitters']],
  ['Martini Bianco', 'Martini', 'Vermouth', [750, 1000], ['martini bianco', 'vermut']],
  ['Martini Rosso', 'Martini', 'Vermouth', [750, 1000], ['martini rosso']],
  ['Martini Extra Dry', 'Martini', 'Vermouth', [750, 1000], ['martini dry']],
  ['Cinzano Bianco', 'Cinzano', 'Vermouth', [750, 1000], ['cinzano']],
  ['Punt e Mes', 'Punt e Mes', 'Vermouth', [750], ['punt mes']],
  ['Select Aperitivo', 'Select', 'Aperitif', [700], ['select aperitivo']],
  ['Lillet Blanc', 'Lillet', 'Aperitif', [750], ['lillet']],
  ['Fernet-Branca', 'Fernet-Branca', 'Aperitif', [700], ['fernet']],
  ['Ursus Cooler', 'Ursus', 'Beer', [330, 500], ['ursus cooler']],
  ['Timișoreana', 'Timișoreana', 'Beer', [330, 500], ['timisoreana', 'timișoreana']],
  ['Ciucaș', 'Ciucaș', 'Beer', [330, 500], ['ciucas', 'ciucaș']],
  ['Bergenbier', 'Bergenbier', 'Beer', [330, 500], ['bergenbier']],
  ['Neumarkt', 'Neumarkt', 'Beer', [500], ['neumarkt']],
  ['Silva Premium', 'Silva', 'Beer', [500], ['silva']],
  ['Heineken 0.0', 'Heineken', 'Beer', [330, 500], ['heineken zero', 'heineken 0']],
  ['Beck’s', 'Beck’s', 'Beer', [330, 500], ['beck', 'becks']],
  ['Stella Artois', 'Stella Artois', 'Beer', [330, 500], ['stella']],
  ['Peroni Nastro Azzurro', 'Peroni', 'Beer', [330, 500], ['peroni']],
  ['Tuborg Green', 'Tuborg', 'Beer', [330, 500], ['tuborg']],
  ['Carlsberg', 'Carlsberg', 'Beer', [330, 500], ['carlsberg']],
  ['Corona Cero', 'Corona', 'Beer', [330], ['corona zero', 'corona cero']],
  ['Guinness Draught', 'Guinness', 'Beer', [440, 500], ['guinness']],
  ['Leffe Blonde', 'Leffe', 'Beer', [330, 500], ['leffe']],
  ['Hoegaarden', 'Hoegaarden', 'Beer', [330, 500], ['hoegaarden']],
  ['Desperados', 'Desperados', 'Beer', [330, 500], ['desperados']],
  ['Strongbow Gold Apple', 'Strongbow', 'Cider', [330, 500], ['strongbow', 'cider']],
  ['Somersby Apple', 'Somersby', 'Cider', [330, 500], ['somersby']],
  ['Kopparberg Pear', 'Kopparberg', 'Cider', [500], ['kopparberg']],
  ['Jidvei Grasă de Cotnari', 'Jidvei', 'Wine', [750], ['jidvei', 'grasa de cotnari']],
  ['Tămâioasă Românească', 'Jidvei', 'Wine', [750], ['tamaioasa', 'tămâioasă']],
  ['Purcari Cabernet Sauvignon', 'Purcari', 'Wine', [750], ['purcari', 'cabernet']],
  ['Purcari Chardonnay', 'Purcari', 'Wine', [750], ['purcari chardonnay']],
  ['Budureasca Fetească Neagră', 'Budureasca', 'Wine', [750], ['budureasca', 'feteasca neagra']],
  ['Recaș Rose', 'Recaș', 'Wine', [750], ['recas', 'recaș rose']],
  ['Murfatlar Pinot Grigio', 'Murfatlar', 'Wine', [750], ['murfatlar', 'pinot grigio']],
  ['Cramele Recaș Solo Quinta', 'Recaș', 'Wine', [750], ['solo quinta']],
  ['Yellow Tail Shiraz', 'Yellow Tail', 'Wine', [750], ['yellow tail']],
  ['Barefoot Merlot', 'Barefoot', 'Wine', [750], ['barefoot']],
  ['Mateus Rosé', 'Mateus', 'Wine', [750], ['mateus']],
  ['Asti Martini', 'Martini', 'Sparkling wine', [750], ['asti']],
  ['Mionetto Prosecco', 'Mionetto', 'Sparkling wine', [750, 1500], ['mionetto']],
  ['Freixenet Cava', 'Freixenet', 'Sparkling wine', [750], ['freixenet', 'cava']],
  ['Moët & Chandon Brut', 'Moët & Chandon', 'Champagne', [750], ['moet', 'champagne']],
  ['Veuve Clicquot Yellow Label', 'Veuve Clicquot', 'Champagne', [750], ['veuve clicquot']],
  ['Coca-Cola Zero', 'Coca-Cola', 'Cola', [330, 500, 1000, 1500, 2000], ['coke', 'coca zero', 'coke zero']],
  ['Coca-Cola Cherry', 'Coca-Cola', 'Cola', [330, 500], ['coke cherry']],
  ['Pepsi Max', 'Pepsi', 'Cola', [330, 500, 1500], ['pepsi max']],
  ['Pepsi Twist', 'Pepsi', 'Cola', [330, 500], ['pepsi twist']],
  ['7UP', '7UP', 'Lemon-lime', [330, 500, 1500], ['seven up', 'sevenup']],
  ['Mirinda Orange', 'Mirinda', 'Soft drinks', [330, 500, 1500], ['mirinda']],
  ['Schweppes Bitter Lemon', 'Schweppes', 'Soft drinks', [330, 500, 1000], ['bitter lemon']],
  ['Schweppes Ginger Ale', 'Schweppes', 'Soft drinks', [330, 500, 1000], ['ginger ale']],
  ['Fuzetea Lemon', 'Fuzetea', 'Soft drinks', [500, 1500], ['fuze tea', 'fuzetea']],
  ['Nestea Lemon', 'Nestea', 'Soft drinks', [500, 1500], ['nestea']],
  ['Cappy Orange', 'Cappy', 'Juice', [330, 1000], ['cappy']],
  ['Prigat Orange', 'Prigat', 'Juice', [250, 1000], ['prigat']],
  ['Tymbark Apple', 'Tymbark', 'Juice', [250, 1000], ['tymbark']],
  ['Santal Orange', 'Santal', 'Juice', [1000], ['santal']],
  ['Aqua Carpatica', 'Aqua Carpatica', 'Water', [500, 750, 1500], ['aqua carpatica', 'aqua']],
  ['Bucovina', 'Bucovina', 'Water', [500, 750, 1500, 2000], ['bucovina']],
  ['Izvorul Minunilor', 'Izvorul Minunilor', 'Water', [500, 1500, 2000], ['izvorul minunilor']],
  ['Perla Harghitei', 'Perla Harghitei', 'Water', [500, 1500], ['perla harghitei']],
  ['Borsec carbogazoasă', 'Borsec', 'Water', [500, 750, 1500], ['borsec carbogazoasa', 'borsec carbogazoasă']],
  ['Red Bull Sugarfree', 'Red Bull', 'Energy drinks', [250, 355, 473], ['red bull zero', 'redbull']],
  ['Red Bull Tropical', 'Red Bull', 'Energy drinks', [250, 355], ['red bull tropical']],
  ['Monster Ultra', 'Monster', 'Energy drinks', [500], ['monster ultra']],
  ['Monster Mango Loco', 'Monster', 'Energy drinks', [500], ['mango loco']],
  ['Hell Classic', 'Hell', 'Energy drinks', [250, 500], ['hell']],
  ['Hell Strong', 'Hell', 'Energy drinks', [250, 500], ['hell strong']],
  ['Burn Original', 'Burn', 'Energy drinks', [250, 500], ['burn']],
  ['Rockstar Original', 'Rockstar', 'Energy drinks', [500], ['rockstar']],
  ['Fever-Tree Indian Tonic', 'Fever-Tree', 'Tonic', [200, 500, 750], ['fever tree', 'fever-tree']],
  ['Fever-Tree Mediterranean Tonic', 'Fever-Tree', 'Tonic', [200, 500], ['mediterranean tonic']],
  ['Thomas Henry Tonic', 'Thomas Henry', 'Tonic', [200, 750], ['thomas henry']],
  ['Schweppes Tonic Water', 'Schweppes', 'Tonic', [330, 500, 1000], ['schweppes tonic', 'tonic']],
  ['Ginger Beer', 'Fever-Tree', 'Mixers', [200, 500], ['ginger beer']],
  ['Grenadine', 'Monin', 'Mixers', [250, 1000], ['grenadine', 'monin']],
  ['Vanilla Syrup', 'Monin', 'Mixers', [250, 1000], ['vanilla syrup']],
  ['Lime Cordial', 'Roses', 'Mixers', [300, 750], ['roses lime', 'lime cordial']],
  ['Aperol Spritz', 'Aperol', 'Cocktails', [300, 1000], ['aperol spritz']],
  ['Hugo Spritz', 'Hugo', 'Cocktails', [750, 1000], ['hugo']],
  ['Mojito mix', 'Monin', 'Cocktails', [1000], ['mojito mix']],
  ['Margarita mix', 'Monin', 'Cocktails', [1000], ['margarita mix']],
  ['Virgin Mojito', 'Generic', 'Non-alcoholic drinks', [250, 500, 1000], ['virgin mojito']],
  ['Bitter San Pellegrino', 'San Pellegrino', 'Non-alcoholic drinks', [200], ['bitter san pellegrino']],
  ['Absolut Citron', 'Absolut', 'Vodka', [700, 1000], ['absolut lemon', 'citron']],
  ['Absolut Lime', 'Absolut', 'Vodka', [700], ['absolut lime']],
  ['Absolut Vanilia', 'Absolut', 'Vodka', [700], ['absolut vanilla']],
  ['Absolut Raspberry', 'Absolut', 'Vodka', [700], ['absolut zmeura']],
  ['Smirnoff Black', 'Smirnoff', 'Vodka', [700], ['smirnoff black']],
  ['Finlandia Cranberry', 'Finlandia', 'Vodka', [700], ['finlandia cranberry']],
  ['Stalinskaya', 'Stalinskaya', 'Vodka', [500, 700], ['stalinskaya']],
  ['Stalinskaya Blue', 'Stalinskaya', 'Vodka', [700], ['stalinskaya blue']],
  ['Captain Morgan Dark Rum', 'Captain Morgan', 'Rum', [700, 1000], ['captain dark']],
  ['Captain Morgan White Rum', 'Captain Morgan', 'Rum', [700], ['captain white']],
  ['Bacardi Carta Negra', 'Bacardi', 'Rum', [700], ['bacardi negra']],
  ['Bacardi Carta Oro', 'Bacardi', 'Rum', [700], ['bacardi oro']],
  ['Malibu Pineapple', 'Malibu', 'Liqueur', [700], ['malibu pineapple']],
  ['Malibu Strawberry', 'Malibu', 'Liqueur', [700], ['malibu strawberry']],
  ['Bumbu Original', 'Bumbu', 'Rum', [700], ['bumbu']],
  ['Don Papa Rum', 'Don Papa', 'Rum', [700], ['don papa']],
  ['Diplomático Reserva Exclusiva', 'Diplomático', 'Rum', [700], ['diplomatico']],
  ['Zacapa 23', 'Zacapa', 'Rum', [700], ['zacapa']],
  ['Brugal Añejo', 'Brugal', 'Rum', [700], ['brugal']],
  ['Barceló Imperial', 'Barceló', 'Rum', [700], ['barcelo']],
  ["Gordon's Pink Gin", "Gordon's", 'Gin', [700], ['gordons pink', 'pink gin']],
  ["Gordon's Sicilian Lemon", "Gordon's", 'Gin', [700], ['gordons lemon']],
  ['Tanqueray Sevilla', 'Tanqueray', 'Gin', [700], ['tanqueray orange', 'sevilla']],
  ['Bombay Bramble', 'Bombay', 'Gin', [700], ['bombay bramble']],
  ['Hendrick’s Neptunia', 'Hendrick’s', 'Gin', [700], ['hendricks neptunia']],
  ['Malfy Rosa', 'Malfy', 'Gin', [700], ['malfy rosa']],
  ['Malfy Con Arancia', 'Malfy', 'Gin', [700], ['malfy orange', 'arancia']],
  ['Sierra Reposado', 'Sierra', 'Tequila', [700], ['sierra reposado']],
  ['Jose Cuervo Especial Silver', 'Jose Cuervo', 'Tequila', [700], ['cuervo silver']],
  ['Olmeca Altos Plata', 'Olmeca Altos', 'Tequila', [700], ['olmeca altos']],
  ['Patrón Reposado', 'Patrón', 'Tequila', [700], ['patron reposado']],
  ['Alexandrion 5 Stars', 'Alexandrion', 'Brandy', [200, 500, 700], ['alexandrion 5']],
  ['Alexandrion XO', 'Alexandrion', 'Brandy', [700], ['alexandrion xo']],
  ['Brâncoveanu VSOP', 'Brâncoveanu', 'Brandy', [700], ['brancoveanu vsop']],
  ['Miorița VSOP', 'Miorița', 'Vinars', [700], ['miorita vsop']],
  ['Hennessy XO', 'Hennessy', 'Cognac', [700], ['hennessy xo']],
  ['Rémy Martin XO', 'Rémy Martin', 'Cognac', [700], ['remy martin xo']],
  ['Courvoisier VSOP', 'Courvoisier', 'Cognac', [700], ['courvoisier']],
  ['Metaxa 5 Stars', 'Metaxa', 'Brandy', [700], ['metaxa 5']],
  ['St-Rémy XO', 'St-Rémy', 'Brandy', [700], ['st remy']],
  ['Jägermeister Manifest', 'Jägermeister', 'Liqueur', [1000], ['jager manifest']],
  ['Jägermeister Orange', 'Jägermeister', 'Liqueur', [700], ['jager orange']],
  ['Cynar', 'Cynar', 'Aperitif', [700], ['cynar']],
  ['Ramazzotti', 'Ramazzotti', 'Aperitif', [700], ['ramazzotti']],
  ['Kahlúa Coffee Liqueur', 'Kahlúa', 'Coffee Liqueur', [700], ['kahlua coffee']],
  ['Grand Marnier', 'Grand Marnier', 'Liqueur', [700], ['grand marnier']],
  ['Tia Maria', 'Tia Maria', 'Coffee Liqueur', [700], ['tia maria']],
  ['Amaro Montenegro', 'Montenegro', 'Aperitif', [700], ['amaro montenegro']],
  ['Martini Bianco', 'Martini', 'Vermouth', [750, 1000], ['martini bianco']],
  ['Cinzano Rosso', 'Cinzano', 'Vermouth', [750, 1000], ['cinzano rosso']],
  ['Noilly Prat Original Dry', 'Noilly Prat', 'Vermouth', [750], ['noilly prat']],
  ['Zarea 5 Stele', 'Zarea', 'Vinars', [700], ['zarea 5 stele']],
  ['Jidvei Vinars VSOP', 'Jidvei', 'Vinars', [700], ['jidvei vinars']],
  ['Sâmburești Fetească Neagră', 'Sâmburești', 'Wine', [750], ['samburesti']],
  ['Davino Iacob', 'Davino', 'Wine', [750], ['davino']],
  ['SERVE Terra Romana', 'SERVE', 'Wine', [750], ['serve terra romana']],
  ['Avincis Negru de Drăgășani', 'Avincis', 'Wine', [750], ['avincis']],
  ['Lacerta Chardonnay', 'Lacerta', 'Wine', [750], ['lacerta']],
  ['Cricova Brut', 'Cricova', 'Sparkling wine', [750], ['cricova brut']],
  ['Zarea Crystal Collection', 'Zarea', 'Sparkling wine', [750], ['zarea crystal']],
  ['Riunite Lambrusco', 'Riunite', 'Sparkling wine', [750], ['riunite lambrusco']],
  ['Mumm Cordon Rouge', 'Mumm', 'Champagne', [750], ['mumm']],
  ['Taittinger Brut Réserve', 'Taittinger', 'Champagne', [750], ['taittinger']],
  ['Old Mout Apple', 'Old Mout', 'Cider', [500], ['old mout']],
  ['Magners Original', 'Magners', 'Cider', [568], ['magners']],
  ['Rekorderlig Strawberry-Lime', 'Rekorderlig', 'Cider', [500], ['rekorderlig']],
  ['Somersby Blackberry', 'Somersby', 'Cider', [330, 500], ['somersby blackberry']],
  ['Kopparberg Mixed Fruit', 'Kopparberg', 'Cider', [500], ['kopparberg fruit']],
  ['Amstel 0.0', 'Amstel', 'Beer', [330, 500], ['amstel zero', 'amstel 0']],
  ['Birra Moretti', 'Birra Moretti', 'Beer', [330, 500], ['moretti']],
  ['Peroni 0.0', 'Peroni', 'Beer', [330, 500], ['peroni zero']],
  ['Kozel Premium', 'Kozel', 'Beer', [330, 500], ['kozel']],
  ['Kozel Dark', 'Kozel', 'Beer', [500], ['kozel dark']],
  ['Staropramen', 'Staropramen', 'Beer', [500], ['staropramen']],
  ['Pilsner Urquell', 'Pilsner Urquell', 'Beer', [500], ['pilsner urquell']],
  ['Paulaner Weissbier', 'Paulaner', 'Beer', [500], ['paulaner']],
  ['Erdinger Weissbier', 'Erdinger', 'Beer', [500], ['erdinger']],
  ['Guinness 0.0', 'Guinness', 'Beer', [440], ['guinness zero']],
  ['Zăganu IPA', 'Zăganu', 'Beer', [330, 500], ['zaganu', 'zăganu']],
  ['Hophead IPA', 'Hophead', 'Beer', [330, 500], ['hophead']],
  ['Hop Hooligans', 'Hop Hooligans', 'Beer', [330, 500], ['hop hooligans']],
  ['Bereta IPA', 'Bereta', 'Beer', [330, 500], ['bereta']],
  ['Csíki Sör', 'Csíki Sör', 'Beer', [500], ['csiki', 'csíki']],
  ['Gekkeikan Sake', 'Gekkeikan', 'Sake', [300, 720], ['gekkeikan', 'sake']],
  ['Choya Umeshu', 'Choya', 'Liqueur', [500, 700], ['umeshu', 'choya']],
  ['Jinro Chamisul Original', 'Jinro', 'Shochu', [350], ['jinro soju', 'soju']],
  ['Ouzo 12', 'Ouzo 12', 'Ouzo', [200, 700], ['ouzo']],
  ['Jelinek Slivovitz', 'Jelinek', 'Rachiu', [500, 700], ['slivovitz', 'rachiu']],
  ['Casa Pălincii Pălincă de Prune', 'Casa Pălincii', 'Pălincă', [500, 700], ['palinca', 'pălincă']],
  ['Casa Pălincii Afinată', 'Casa Pălincii', 'Afinată', [500], ['afinata', 'afinată']],
  ['Casa Pălincii Vișinată', 'Casa Pălincii', 'Vișinată', [500], ['visinata', 'vișinată']],
  ['Sâniuta', 'Sâniuta', 'Rachiu', [200, 500], ['saniuta', 'săniuța']],
  ['Bacardi Mojito', 'Bacardi', 'Cocktails', [330, 500], ['bacardi mojito']],
  ['Bacardi Breezer Lime', 'Bacardi', 'Cocktails', [275], ['breezer']],
  ['Smirnoff Ice', 'Smirnoff', 'Cocktails', [275, 330], ['smirnoff ice']],
  ['Gordon’s Gin & Tonic', "Gordon's", 'Cocktails', [330], ['gordons tonic']],
  ['Captain Morgan & Cola', 'Captain Morgan', 'Cocktails', [330], ['captain cola']],
  ['Desperados Mojito', 'Desperados', 'Cocktails', [330], ['desperados mojito']],
];

const catalog: DrinkCatalogItem[] = seeds.map((seed) => {
  if (Array.isArray(seed)) {
    const [name, brand, category, volumesMl, aliases = []] = seed;
    return { id: slugify(`${brand}-${name}`), name, brand, category, aliases: [...new Set([name, brand, ...aliases].map(normalize))], volumesMl, packagingTypes: defaultPackaging(category), alcoholFree: /0\.0|fără alcool|fara alcool|zero/i.test(name), source: 'curated-retail' };
  }
  return { ...seed, aliases: [...new Set([seed.name, seed.brand].map(normalize))], packagingTypes: defaultPackaging(seed.category), alcoholFree: /0\.0|fără alcool|fara alcool|zero/i.test(seed.name), source: 'curated-retail' };
});

const verifiedRomanianAdditions: DrinkCatalogItem[] = [
  { id: 'florentino-visine', name: 'Florentino Vișine', brand: 'Florentino', category: 'Liqueur', subcategory: 'Fruit Liqueur', aliases: ['flor', 'florentino', 'florentino visine', 'visine', 'vișine'], volumesMl: [200, 500, 2000], packagingTypes: ['bottle'], alcoholPercent: 16, source: 'curated-retail' },
  { id: 'florentino-caise', name: 'Florentino Caise', brand: 'Florentino', category: 'Liqueur', subcategory: 'Fruit Liqueur', aliases: ['flor', 'florentino', 'florentino caise', 'caise'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 16, source: 'curated-retail' },
  { id: 'florentino-afine', name: 'Florentino Afine', brand: 'Florentino', category: 'Liqueur', subcategory: 'Fruit Liqueur', aliases: ['flor', 'florentino', 'florentino afine', 'afine'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 16, source: 'curated-retail' },
  { id: 'florentino-ciocolata', name: 'Florentino Ciocolată', brand: 'Florentino', category: 'Liqueur', subcategory: 'Chocolate Liqueur', aliases: ['flor', 'florentino', 'florentino ciocolata', 'ciocolata'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 13, source: 'curated-retail' },
  { id: 'florentino-capsuni', name: 'Florentino Căpșuni', brand: 'Florentino', category: 'Liqueur', subcategory: 'Fruit Liqueur', aliases: ['flor', 'florentino', 'florentino capsuni', 'capsuni'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 16, source: 'curated-retail' },
  { id: 'florentino-piersici', name: 'Florentino Piersici', brand: 'Florentino', category: 'Liqueur', subcategory: 'Fruit Liqueur', aliases: ['flor', 'florentino', 'florentino piersici', 'piersici'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 16, source: 'curated-retail' },
  { id: 'florentino-fructe-padure', name: 'Florentino Fructe de pădure', brand: 'Florentino', category: 'Liqueur', subcategory: 'Fruit Liqueur', aliases: ['flor', 'florentino', 'florentino fructe padure', 'fructe de padure'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 16, source: 'curated-retail' },
  { id: 'florentino-menta', name: 'Florentino Mentă', brand: 'Florentino', category: 'Liqueur', subcategory: 'Herbal Liqueur', aliases: ['flor', 'florentino', 'florentino menta', 'menta'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 13, source: 'curated-retail' },
  { id: 'florentino-cappuccino', name: 'Florentino Cappuccino', brand: 'Florentino', category: 'Liqueur', subcategory: 'Coffee Liqueur', aliases: ['flor', 'florentino', 'florentino cappuccino', 'cappuccino'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 13, source: 'curated-retail' },
  { id: 'florentino-limoncello', name: 'Florentino Limoncello', brand: 'Florentino', category: 'Liqueur', subcategory: 'Fruit Liqueur', aliases: ['flor', 'florentino', 'florentino limoncello', 'limoncello'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 13, source: 'curated-retail' },
  { id: 'florentino-limonata', name: 'Florentino Limonata', brand: 'Florentino', category: 'Cocktails', subcategory: 'Ready to Drink', aliases: ['flor', 'florentino', 'florentino limonata', 'limonata'], volumesMl: [750], packagingTypes: ['bottle'], alcoholPercent: 7, source: 'curated-retail' },
  { id: 'dorato-florentino', name: 'Dorato Florentino', brand: 'Florentino', category: 'Sparkling wine', subcategory: 'Frizzante', aliases: ['flor', 'florentino', 'dorato florentino', 'dorato'], volumesMl: [750], packagingTypes: ['bottle'], source: 'curated-retail' },
  { id: 'alexandrion-5-500', name: 'Alexandrion 5 Stele', brand: 'Alexandrion', category: 'Brandy', subcategory: 'Vinars', aliases: ['alexandrion', 'alex 5'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 37.5, source: 'curated-retail' },
  { id: 'alexandrion-5-1000', name: 'Alexandrion 5 Stele', brand: 'Alexandrion', category: 'Brandy', subcategory: 'Vinars', aliases: ['alexandrion', 'alex 5'], volumesMl: [1000], packagingTypes: ['bottle'], alcoholPercent: 37.5, source: 'curated-retail' },
  { id: 'alexandrion-7-500', name: 'Alexandrion 7 Stele', brand: 'Alexandrion', category: 'Brandy', subcategory: 'Vinars', aliases: ['alexandrion', 'alex 7'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 40, source: 'curated-retail' },
  { id: 'alexandrion-7-700', name: 'Alexandrion 7 Stele', brand: 'Alexandrion', category: 'Brandy', subcategory: 'Vinars', aliases: ['alexandrion', 'alex 7'], volumesMl: [700], packagingTypes: ['bottle'], alcoholPercent: 40, source: 'curated-retail' },
  { id: 'alexandrion-9-700', name: 'Alexandrion 9 Stele', brand: 'Alexandrion', category: 'Brandy', subcategory: 'Vinars', aliases: ['alexandrion', 'alex 9'], volumesMl: [700], packagingTypes: ['bottle'], alcoholPercent: 40, source: 'curated-retail' },
  { id: 'milcov-cognac-500', name: 'Cognac Clasic Milcov', brand: 'Milcov', category: 'Cognac', aliases: ['milcov', 'cognac milcov'], volumesMl: [500], packagingTypes: ['bottle'], alcoholPercent: 28, source: 'curated-retail' },
  { id: 'milcov-brandy-200', name: 'Brandy Milcov Clasic', brand: 'Milcov', category: 'Brandy', aliases: ['milcov', 'brandy milcov'], volumesMl: [200], packagingTypes: ['bottle'], source: 'curated-retail' },
  { id: 'zarea-ice-alb', name: 'Zarea Ice Alb', brand: 'Zarea', category: 'Sparkling wine', aliases: ['zarea', 'zarea ice'], volumesMl: [750], packagingTypes: ['bottle'], source: 'curated-retail' },
  { id: 'zarea-ice-rose', name: 'Zarea Ice Rosé', brand: 'Zarea', category: 'Sparkling wine', aliases: ['zarea', 'zarea ice rose'], volumesMl: [750], packagingTypes: ['bottle'], source: 'curated-retail' },
  { id: 'zarea-best-wishes', name: 'Zarea Best Wishes', brand: 'Zarea', category: 'Sparkling wine', aliases: ['zarea', 'best wishes'], volumesMl: [750], packagingTypes: ['bottle'], alcoholPercent: 11, source: 'curated-retail' },
  { id: 'zarea-sangria', name: 'Zarea Sangria', brand: 'Zarea', category: 'Cocktails', subcategory: 'Ready to Drink', aliases: ['zarea', 'sangria'], volumesMl: [275], packagingTypes: ['bottle'], source: 'curated-retail' },
  { id: 'zarea-sex-on-the-beach', name: 'Zarea Sex on the Beach', brand: 'Zarea', category: 'Cocktails', subcategory: 'Ready to Drink', aliases: ['zarea', 'sex on the beach'], volumesMl: [750], packagingTypes: ['bottle'], alcoholPercent: 7, source: 'curated-retail' },
  { id: 'zarea-sunrise', name: 'Zarea Sunrise', brand: 'Zarea', category: 'Cocktails', subcategory: 'Ready to Drink', aliases: ['zarea', 'sunrise'], volumesMl: [700], packagingTypes: ['bottle'], alcoholPercent: 13, source: 'curated-retail' },
  { id: 'zarea-hugo-rose', name: 'Zarea Cocktail Hugo Rosé', brand: 'Zarea', category: 'Cocktails', subcategory: 'Ready to Drink', aliases: ['zarea', 'hugo rose'], volumesMl: [750], packagingTypes: ['bottle'], source: 'curated-retail' },
  { id: 'zarea-mojito', name: 'Zarea Cocktail Mojito', brand: 'Zarea', category: 'Cocktails', subcategory: 'Ready to Drink', aliases: ['zarea', 'mojito'], volumesMl: [700], packagingTypes: ['bottle'], alcoholPercent: 13, source: 'curated-retail' },
  { id: 'zarea-lambrusco-rose', name: 'Zarea Lambrusco Rosé', brand: 'Zarea', category: 'Sparkling wine', aliases: ['zarea', 'lambrusco rose'], volumesMl: [750], packagingTypes: ['bottle'], source: 'curated-retail' },
  { id: 'zarea-lambrusco-red', name: 'Zarea Lambrusco Rosu', brand: 'Zarea', category: 'Sparkling wine', aliases: ['zarea', 'lambrusco rosu'], volumesMl: [750], packagingTypes: ['bottle'], source: 'curated-retail' },
  { id: 'zarea-crystal-3l', name: 'Zarea Cristal Demisec', brand: 'Zarea', category: 'Sparkling wine', aliases: ['zarea', 'cristal'], volumesMl: [3000], packagingTypes: ['bag-in-box'], source: 'curated-retail' },
];

catalog.push(
  ...verifiedRomanianAdditions.map((item) => ({
    ...item,
    aliases: [...new Set([item.name, item.brand, ...item.aliases].map(normalize))],
  })),
);

export function getDrinkCatalog() {
  return catalog;
}

export function searchDrinkCatalog(query: string, category: DrinkCategory | DrinkQuickFilter = 'all', limit = 12) {
  const normalized = normalize(query);
  const quickFilterCategories = DRINK_QUICK_FILTER_CATEGORIES[category as DrinkQuickFilter];
  const categories = quickFilterCategories === null
    ? null
    : quickFilterCategories ?? [category as DrinkCategory];
  return catalog
    .filter((item) => !categories || categories.includes(item.category))
    .filter((item) => !normalized || item.aliases.some((alias) => alias.includes(normalized)) || normalize(item.category).includes(normalized))
    .slice(0, limit);
}

export function formatDrinkVolume(volumeMl?: number) {
  if (!volumeMl || volumeMl <= 0) return '';
  return volumeMl >= 1000 && volumeMl % 1000 === 0 ? `${volumeMl / 1000} L` : `${volumeMl} ml`;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function defaultPackaging(category: DrinkCategory): PackagingType[] {
  if (category === 'Beer' || category === 'Cider') return ['can', 'bottle'];
  if (category === 'Wine' || category === 'Sparkling wine' || category === 'Champagne') return ['bottle', 'bag-in-box', 'magnum'];
  if (category === 'Soft drinks' || category === 'Cola' || category === 'Lemon-lime' || category === 'Energy drinks') return ['can', 'bottle', 'PET'];
  return ['bottle'];
}

const eventDrinks = new Map<string, EventDrink[]>();

export function getEventDrinks(eventId: string) {
  return eventDrinks.get(eventId) ?? [];
}

export function setEventDrinks(eventId: string, drinks: EventDrink[]) {
  eventDrinks.set(eventId, drinks.map((drink) => ({ ...drink })));
}
