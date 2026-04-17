/*
  # Creation des equipements de formation pour les 4 parcs

  1. Nouvelles donnees
    - ~40 equipements de formation repartis sur les 4 parcs (FRA, SGB, DOM, ALF)
    - Couvrent les categories : Trampoline, Bowling, Arcade, Laser Game, Karting,
      Securite, Ninja, SoftPlay, Chateau gonflable, Sanitaire
    - Chaque equipement a un code prefixe par le parc (ex: FRA-TRAMP-01)
    - Dates de mise en service echelonnees sur 3 ans

  2. Notes
    - Les equipements sont crees pour alimenter les controles de formation
    - Certains sont marques a_surveiller pour tester les recurrences
*/

INSERT INTO equipements (id, parc_id, zone_id, categorie_id, code, libelle, date_mise_service, date_fin_garantie, statut, a_surveiller) VALUES
-- FRA (Franconville) - Zone Trampolines
('a0000001-0001-0001-0001-000000000001', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', 'c8f9a470-79b0-4698-ac2a-e5a1e6be6b76', 'ba98f6aa-ab3a-4f96-af6f-de981da23e9d', 'FRA-TRAMP-01', 'Trampoline principal A', '2023-03-15', '2026-03-15', 'actif', false),
('a0000001-0001-0001-0001-000000000002', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', 'c8f9a470-79b0-4698-ac2a-e5a1e6be6b76', 'ba98f6aa-ab3a-4f96-af6f-de981da23e9d', 'FRA-TRAMP-02', 'Trampoline principal B', '2023-03-15', '2026-03-15', 'actif', true),
('a0000001-0001-0001-0001-000000000003', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', 'c8f9a470-79b0-4698-ac2a-e5a1e6be6b76', 'ba98f6aa-ab3a-4f96-af6f-de981da23e9d', 'FRA-TRAMP-03', 'Trampoline dodgeball', '2023-06-01', '2026-06-01', 'actif', false),
-- FRA - Zone Ninja
('a0000001-0001-0001-0001-000000000004', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', 'd5d76f5c-36f9-4a04-a5b1-0d0dcff43170', 'f34295e0-a713-488c-9874-83847b9a23c1', 'FRA-NINJA-01', 'Parcours Ninja adultes', '2023-09-01', '2026-09-01', 'actif', false),
-- FRA - Zone Toboggans
('a0000001-0001-0001-0001-000000000005', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', '594d109b-1ddf-44c7-9156-a008642a21df', '4c5603b7-bf20-4fcc-a638-a40a692f9318', 'FRA-SOFT-01', 'SoftPlay zone enfants', '2023-03-15', '2026-03-15', 'actif', false),
('a0000001-0001-0001-0001-000000000006', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', '594d109b-1ddf-44c7-9156-a008642a21df', 'f75772d8-e41c-48f8-b460-022b75de2f7b', 'FRA-SECU-01', 'Securite sorties de secours', '2023-03-15', NULL, 'actif', false),
('a0000001-0001-0001-0001-000000000007', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', '594d109b-1ddf-44c7-9156-a008642a21df', '528abb79-8a0d-4d9e-9cad-146565b2dc43', 'FRA-ARCADE-01', 'Borne arcade zone 1', '2024-01-10', '2026-01-10', 'actif', false),
('a0000001-0001-0001-0001-000000000008', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', '594d109b-1ddf-44c7-9156-a008642a21df', '528abb79-8a0d-4d9e-9cad-146565b2dc43', 'FRA-ARCADE-02', 'Borne arcade zone 2', '2024-01-10', '2026-01-10', 'actif', false),
('a0000001-0001-0001-0001-000000000009', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', '594d109b-1ddf-44c7-9156-a008642a21df', '9e5e9a35-9728-485d-ad78-8b8cf62b55c2', 'FRA-LASER-01', 'Pack laser game 20 gilets', '2023-06-15', '2025-06-15', 'actif', true),
('a0000001-0001-0001-0001-000000000010', '9fefd3d6-4a42-46fb-a09e-2f3b670628a4', '594d109b-1ddf-44c7-9156-a008642a21df', 'bf41c236-4082-40ac-a3f0-fb9d541ca0bc', 'FRA-SANIT-01', 'Bloc sanitaire principal', '2023-03-15', NULL, 'actif', false),

-- SGB (Sainte-Genevieve) - Zone Trampolines
('a0000001-0002-0001-0001-000000000001', '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', '6b0957dd-0ccb-4f6a-ab60-69aa414c7d54', 'ba98f6aa-ab3a-4f96-af6f-de981da23e9d', 'SGB-TRAMP-01', 'Trampoline principal A', '2022-11-20', '2025-11-20', 'actif', false),
('a0000001-0002-0001-0001-000000000002', '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', '6b0957dd-0ccb-4f6a-ab60-69aa414c7d54', 'ba98f6aa-ab3a-4f96-af6f-de981da23e9d', 'SGB-TRAMP-02', 'Trampoline dodgeball', '2022-11-20', '2025-11-20', 'actif', true),
-- SGB - Zone Toboggans
('a0000001-0002-0001-0001-000000000003', '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', 'c6f7180a-c960-4e79-9c74-d45c4b6c111e', 'f376951c-d492-4a4a-abf9-1b09364df79f', 'SGB-BOWL-01', 'Piste bowling 1-4', '2022-11-20', '2025-11-20', 'actif', false),
('a0000001-0002-0001-0001-000000000004', '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', 'c6f7180a-c960-4e79-9c74-d45c4b6c111e', 'f376951c-d492-4a4a-abf9-1b09364df79f', 'SGB-BOWL-02', 'Piste bowling 5-8', '2022-11-20', '2025-11-20', 'actif', false),
('a0000001-0002-0001-0001-000000000005', '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', 'c6f7180a-c960-4e79-9c74-d45c4b6c111e', '6adbe695-ac50-4b4e-84ff-644859ef29cd', 'SGB-KART-01', 'Circuit karting electrique', '2023-04-01', '2026-04-01', 'actif', false),
-- SGB - Zone Accueil
('a0000001-0002-0001-0001-000000000006', '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', 'f77d5e87-d8e8-4c2f-8325-03ee1e57d34c', 'f75772d8-e41c-48f8-b460-022b75de2f7b', 'SGB-SECU-01', 'Securite sorties de secours', '2022-11-20', NULL, 'actif', false),
('a0000001-0002-0001-0001-000000000007', '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', 'f77d5e87-d8e8-4c2f-8325-03ee1e57d34c', 'bf41c236-4082-40ac-a3f0-fb9d541ca0bc', 'SGB-SANIT-01', 'Bloc sanitaire principal', '2022-11-20', NULL, 'actif', false),
('a0000001-0002-0001-0001-000000000008', '6b2634dd-7a71-4dbc-a19f-97c3bdefcb3f', 'f77d5e87-d8e8-4c2f-8325-03ee1e57d34c', '528abb79-8a0d-4d9e-9cad-146565b2dc43', 'SGB-ARCADE-01', 'Bornes arcade accueil', '2023-06-01', '2025-06-01', 'actif', false),

-- DOM (Rosny Domus) - Zone Trampolines
('a0000001-0003-0001-0001-000000000001', 'cfd13e83-aa27-450b-93e1-d631b1dbe306', '05ffad15-cac0-433f-91cb-b683ce287c2a', 'ba98f6aa-ab3a-4f96-af6f-de981da23e9d', 'DOM-TRAMP-01', 'Trampoline principal A', '2023-09-01', '2026-09-01', 'actif', false),
('a0000001-0003-0001-0001-000000000002', 'cfd13e83-aa27-450b-93e1-d631b1dbe306', '05ffad15-cac0-433f-91cb-b683ce287c2a', 'ba98f6aa-ab3a-4f96-af6f-de981da23e9d', 'DOM-TRAMP-02', 'Trampoline freestyle', '2023-09-01', '2026-09-01', 'actif', true),
-- DOM - Zone Escalade
('a0000001-0003-0001-0001-000000000003', 'cfd13e83-aa27-450b-93e1-d631b1dbe306', '2e7fd794-d61c-41fa-8522-c6e05c741489', '10bb1653-0547-4f62-b1aa-d31ef814fabb', 'DOM-GONFL-01', 'Chateau gonflable geant', '2024-01-15', '2027-01-15', 'actif', false),
('a0000001-0003-0001-0001-000000000004', 'cfd13e83-aa27-450b-93e1-d631b1dbe306', '2e7fd794-d61c-41fa-8522-c6e05c741489', '1bc1b9a6-aa96-4b84-8c71-4d7e69fcfddb', 'DOM-OCTO-01', 'Octogone zone combat', '2023-09-01', '2026-09-01', 'actif', false),
-- DOM - Zone Toboggans
('a0000001-0003-0001-0001-000000000005', 'cfd13e83-aa27-450b-93e1-d631b1dbe306', '9677d3e2-d0b6-4793-96b7-b16bb5b171b2', 'f75772d8-e41c-48f8-b460-022b75de2f7b', 'DOM-SECU-01', 'Securite sorties de secours', '2023-09-01', NULL, 'actif', false),
('a0000001-0003-0001-0001-000000000006', 'cfd13e83-aa27-450b-93e1-d631b1dbe306', '9677d3e2-d0b6-4793-96b7-b16bb5b171b2', '528abb79-8a0d-4d9e-9cad-146565b2dc43', 'DOM-ARCADE-01', 'Bornes arcade enfants', '2024-01-15', '2026-01-15', 'actif', false),
('a0000001-0003-0001-0001-000000000007', 'cfd13e83-aa27-450b-93e1-d631b1dbe306', '9677d3e2-d0b6-4793-96b7-b16bb5b171b2', 'bf41c236-4082-40ac-a3f0-fb9d541ca0bc', 'DOM-SANIT-01', 'Bloc sanitaire RDC', '2023-09-01', NULL, 'actif', false),

-- ALF (Alfortville) - Zone Trampolines
('a0000001-0004-0001-0001-000000000001', '7b5f4ba4-3435-4e62-972a-148739e8585f', '804085ff-a3fe-4ab0-8768-afaa1dc1753f', 'ba98f6aa-ab3a-4f96-af6f-de981da23e9d', 'ALF-TRAMP-01', 'Trampoline principal A', '2024-02-01', '2027-02-01', 'actif', false),
('a0000001-0004-0001-0001-000000000002', '7b5f4ba4-3435-4e62-972a-148739e8585f', '804085ff-a3fe-4ab0-8768-afaa1dc1753f', 'ba98f6aa-ab3a-4f96-af6f-de981da23e9d', 'ALF-TRAMP-02', 'Trampoline airbag', '2024-02-01', '2027-02-01', 'actif', false),
-- ALF - Zone Toboggans
('a0000001-0004-0001-0001-000000000003', '7b5f4ba4-3435-4e62-972a-148739e8585f', 'e4cc6785-3579-4a19-bbc3-65951a24d645', '4c5603b7-bf20-4fcc-a638-a40a692f9318', 'ALF-SOFT-01', 'SoftPlay zone petits', '2024-02-01', '2027-02-01', 'actif', false),
('a0000001-0004-0001-0001-000000000004', '7b5f4ba4-3435-4e62-972a-148739e8585f', 'e4cc6785-3579-4a19-bbc3-65951a24d645', '9e5e9a35-9728-485d-ad78-8b8cf62b55c2', 'ALF-LASER-01', 'Pack laser game 16 gilets', '2024-06-01', '2026-06-01', 'actif', true),
-- ALF - Zone Petits
('a0000001-0004-0001-0001-000000000005', '7b5f4ba4-3435-4e62-972a-148739e8585f', '0b7bf2b7-68d4-458b-8af4-0d5b976a7301', 'f75772d8-e41c-48f8-b460-022b75de2f7b', 'ALF-SECU-01', 'Securite sorties de secours', '2024-02-01', NULL, 'actif', false),
('a0000001-0004-0001-0001-000000000006', '7b5f4ba4-3435-4e62-972a-148739e8585f', '0b7bf2b7-68d4-458b-8af4-0d5b976a7301', 'bf41c236-4082-40ac-a3f0-fb9d541ca0bc', 'ALF-SANIT-01', 'Bloc sanitaire principal', '2024-02-01', NULL, 'actif', false),
('a0000001-0004-0001-0001-000000000007', '7b5f4ba4-3435-4e62-972a-148739e8585f', '0b7bf2b7-68d4-458b-8af4-0d5b976a7301', '528abb79-8a0d-4d9e-9cad-146565b2dc43', 'ALF-ARCADE-01', 'Bornes arcade accueil', '2024-06-01', '2026-06-01', 'actif', false),
('a0000001-0004-0001-0001-000000000008', '7b5f4ba4-3435-4e62-972a-148739e8585f', '0b7bf2b7-68d4-458b-8af4-0d5b976a7301', '10bb1653-0547-4f62-b1aa-d31ef814fabb', 'ALF-GONFL-01', 'Chateau gonflable enfants', '2024-04-01', '2027-04-01', 'actif', false)

ON CONFLICT DO NOTHING;
