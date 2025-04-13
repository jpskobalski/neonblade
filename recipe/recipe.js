const recipes = [
    {
      title: "Spicy Miso Ramen",
      source: "NEONBLADE's Kitchen",
      ingredients: [
        "Noodles",
        "Spicy miso tare",
        "Chicken broth",
        "Soft-boiled egg",
        "Chili oil",
        "Ground pork",
        "Scallions",
      ]
    },
    {
      title: "Cyber Tacos 🌮",
      source: "NEONBLADE's Late Night Experiments",
      ingredients: [
        "Blue corn tortillas",
        "Spiced beef",
        "Pickled red onions",
        "Lime crema",
        "Synthwave hot sauce"
      ]
    }
  ];
  
  const container = document.getElementById('recipe-list');
  
  recipes.forEach(recipe => {
    const section = document.createElement('section');
    section.className = 'recipe';
  
    const title = document.createElement('h3');
    title.textContent = recipe.title;
  
    const source = document.createElement('p');
    source.className = 'meta';
    source.textContent = `Source: ${recipe.source}`;
  
    const list = document.createElement('ul');
    recipe.ingredients.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
  
    section.appendChild(title);
    section.appendChild(source);
    section.appendChild(list);
    container.appendChild(section);
  });
  