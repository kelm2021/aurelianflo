const OFAC_WALLET_XML = `<?xml version="1.0" encoding="utf-8"?>
<SanctionsData xmlns="https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ADVANCED_XML">
  <ReferenceValueSets>
    <FeatureTypeValues>
      <FeatureType ID="344">Digital Currency Address - XBT</FeatureType>
      <FeatureType ID="345">Digital Currency Address - ETH</FeatureType>
    </FeatureTypeValues>
    <ListValues>
      <List ID="1550">SDN List</List>
    </ListValues>
    <SanctionsTypeValues>
      <SanctionsType ID="1">Program</SanctionsType>
      <SanctionsType ID="1705">Block</SanctionsType>
    </SanctionsTypeValues>
  </ReferenceValueSets>
  <DistinctParties>
    <DistinctParty FixedRef="27307">
      <Profile ID="27307" PartySubTypeID="3">
        <Identity ID="19011" FixedRef="27307" Primary="true" False="false">
          <Alias FixedRef="27307" AliasTypeID="1403" Primary="true" LowQuality="false">
            <DocumentedName ID="37142" FixedRef="27307" DocNameStatusID="1">
              <DocumentedNamePart>
                <NamePartValue NamePartGroupID="72465">Lazarus Group</NamePartValue>
              </DocumentedNamePart>
            </DocumentedName>
          </Alias>
          <Alias FixedRef="27307" AliasTypeID="1400" Primary="false" LowQuality="true">
            <DocumentedName ID="37271" FixedRef="27307" DocNameStatusID="2">
              <DocumentedNamePart>
                <NamePartValue NamePartGroupID="72499">Hidden Cobra</NamePartValue>
              </DocumentedNamePart>
            </DocumentedName>
          </Alias>
        </Identity>
      </Profile>
      <Feature ID="50215" FeatureTypeID="345">
        <FeatureVersion ID="47914" ReliabilityID="1560">
          <VersionDetail DetailTypeID="1432">0x098B716B8Aaf21512996dC57EB0615e2383E2f96</VersionDetail>
        </FeatureVersion>
        <IdentityReference IdentityID="19011" IdentityFeatureLinkTypeID="1" />
      </Feature>
    </DistinctParty>
    <DistinctParty FixedRef="40001">
      <Profile ID="40001" PartySubTypeID="3">
        <Identity ID="50001" FixedRef="40001" Primary="true" False="false">
          <Alias FixedRef="40001" AliasTypeID="1403" Primary="true" LowQuality="false">
            <DocumentedName ID="60001" FixedRef="40001" DocNameStatusID="1">
              <DocumentedNamePart>
                <NamePartValue NamePartGroupID="70001">Example Mixer</NamePartValue>
              </DocumentedNamePart>
            </DocumentedName>
          </Alias>
        </Identity>
      </Profile>
      <Feature ID="50216" FeatureTypeID="344">
        <FeatureVersion ID="47915" ReliabilityID="1560">
          <VersionDetail DetailTypeID="1432">1BoatSLRHtKNngkdXEeobR76b53LETtpyT</VersionDetail>
        </FeatureVersion>
        <IdentityReference IdentityID="50001" IdentityFeatureLinkTypeID="1" />
      </Feature>
    </DistinctParty>
  </DistinctParties>
  <SanctionsEntries>
    <SanctionsEntry ID="27307" ProfileID="27307" ListID="1550">
      <EntryEvent ID="27307" EntryEventTypeID="1">
        <Date CalendarTypeID="1">
          <Year>2019</Year>
          <Month>9</Month>
          <Day>13</Day>
        </Date>
      </EntryEvent>
      <SanctionsMeasure ID="19425" SanctionsTypeID="1705">
        <DatePeriod CalendarTypeID="1" />
      </SanctionsMeasure>
      <SanctionsMeasure ID="154166" SanctionsTypeID="1">
        <Comment>DPRK3</Comment>
        <DatePeriod CalendarTypeID="1" />
      </SanctionsMeasure>
    </SanctionsEntry>
    <SanctionsEntry ID="40001" ProfileID="40001" ListID="1550">
      <EntryEvent ID="40001" EntryEventTypeID="1">
        <Date CalendarTypeID="1">
          <Year>2022</Year>
          <Month>8</Month>
          <Day>8</Day>
        </Date>
      </EntryEvent>
      <SanctionsMeasure ID="40002" SanctionsTypeID="1705">
        <DatePeriod CalendarTypeID="1" />
      </SanctionsMeasure>
      <SanctionsMeasure ID="40003" SanctionsTypeID="1">
        <Comment>CYBER2</Comment>
        <DatePeriod CalendarTypeID="1" />
      </SanctionsMeasure>
    </SanctionsEntry>
  </SanctionsEntries>
</SanctionsData>
`;

module.exports = {
  OFAC_WALLET_XML,
};
